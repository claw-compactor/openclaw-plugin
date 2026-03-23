/**
 * OpenCompress — Save tokens, sharpen quality on every LLM call.
 *
 * Registers as an OpenClaw Provider. Users select opencompress/* models.
 * Local HTTP proxy compresses requests via opencompress.ai, then forwards
 * to the user's upstream provider. Keys never leave your machine.
 */

import { VERSION, PROXY_PORT, PROXY_HOST, OCC_API, PROVIDER_ID } from "./config.js";
import { generateModelCatalog, resolveUpstream, type ProviderConfig } from "./models.js";
import { startProxy, stopProxy } from "./proxy.js";

// ---------------------------------------------------------------------------
// OpenClaw Plugin Types (duck-typed to avoid internal dependency)
// ---------------------------------------------------------------------------

type ModelApi = "openai-completions" | "openai-responses" | "anthropic-messages" | "google-generative-ai";

type ModelDefinitionConfig = {
  id: string;
  name: string;
  api?: ModelApi;
  reasoning?: boolean;
  input?: string[];
  cost?: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow?: number;
  maxTokens?: number;
  [key: string]: unknown;
};

type ModelProviderConfig = {
  baseUrl: string;
  apiKey?: string;
  api?: ModelApi;
  models: ModelDefinitionConfig[];
  [key: string]: unknown;
};

type ProviderPlugin = {
  id: string;
  label: string;
  aliases?: string[];
  envVars?: string[];
  models?: ModelProviderConfig;
  auth: Array<{
    id: string;
    label: string;
    hint?: string;
    kind: string;
    run: (ctx: any) => Promise<any>;
  }>;
};

type OpenClawPluginApi = {
  id: string;
  name: string;
  version?: string;
  config: Record<string, any>;
  pluginConfig?: Record<string, any>;
  logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
  registerProvider: (provider: ProviderPlugin) => void;
  registerService: (service: { id: string; start: () => void | Promise<void>; stop?: () => void | Promise<void> }) => void;
  registerCommand: (command: { name: string; description: string; acceptsArgs?: boolean; handler: (ctx: { args?: string }) => Promise<{ text: string }> }) => void;
  resolvePath: (input: string) => string;
  on: (hookName: string, handler: unknown) => void;
};

// ---------------------------------------------------------------------------
// API Key helpers
// ---------------------------------------------------------------------------

function getApiKey(api: OpenClawPluginApi): string | undefined {
  // 1. Runtime config (from onboard flow)
  const auth = api.config.auth as any;
  const fromConfig = auth?.profiles?.opencompress?.credentials?.["api-key"]?.apiKey;
  if (fromConfig) return fromConfig;

  // 2. Environment variables (support both old and new names)
  if (process.env.OPENCOMPRESS_API_KEY) return process.env.OPENCOMPRESS_API_KEY;

  // 3. Plugin config
  if (api.pluginConfig?.apiKey) return api.pluginConfig.apiKey as string;

  return undefined;
}

function getProviders(api: OpenClawPluginApi): Record<string, ProviderConfig> {
  return (api.config.models?.providers || {}) as Record<string, ProviderConfig>;
}

// ---------------------------------------------------------------------------
// Provider definition
// ---------------------------------------------------------------------------

function createProvider(api: OpenClawPluginApi): ProviderPlugin {
  return {
    id: PROVIDER_ID,
    label: "OpenCompress",
    aliases: ["oc", "compress"],
    envVars: ["OPENCOMPRESS_API_KEY"],

    models: (() => {
      const providers = getProviders(api);
      const firstProvider = Object.values(providers).find((p) => p.api);
      const primaryApi = (firstProvider?.api as ModelApi) || "openai-completions";
      return {
        baseUrl: `http://${PROXY_HOST}:${PROXY_PORT}/v1`,
        api: primaryApi,
        models: generateModelCatalog(providers) as ModelDefinitionConfig[],
      };
    })(),

    auth: [
      {
        id: "api-key",
        label: "OpenCompress",
        hint: "Save tokens and improve quality on any LLM. Your API keys stay local.",
        kind: "custom",
        run: async (ctx: any) => {
          ctx.prompter.note(
            "🗜️ OpenCompress — save tokens and sharpen quality on every LLM call\n\n" +
            "Use your existing LLM providers. Your API keys stay on your machine.\n" +
            "We compress prompts to reduce costs and improve output quality.",
          );

          const spinner = ctx.prompter.progress("Creating your account...");
          try {
            const res = await fetch(`${OCC_API}/v1/provision`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });

            if (!res.ok) {
              spinner.stop("Failed");
              throw new Error(`Provisioning failed: ${res.statusText}`);
            }

            const data = await res.json() as { apiKey: string; freeCredit: string };
            spinner.stop("Account created!");

            return {
              profiles: [{
                profileId: "default",
                credential: { apiKey: data.apiKey },
              }],
              notes: [
                "🗜️ OpenCompress ready!",
                `💰 ${data.freeCredit} free credit.`,
                "",
                "Select any opencompress/* model to enable compression.",
                "Your existing provider keys are used automatically.",
                "",
                "Dashboard: https://www.opencompress.ai/dashboard",
              ],
            };
          } catch (err) {
            spinner.stop("Failed");
            throw err instanceof Error ? err : new Error(String(err));
          }
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Plugin entry
// ---------------------------------------------------------------------------

const plugin = {
  id: "opencompress",
  name: "OpenCompress",
  description: "Save tokens and sharpen quality on any LLM — use your existing providers",
  version: VERSION,

  register(api: OpenClawPluginApi) {
    // 1. Register as a Provider
    api.registerProvider(createProvider(api));
    api.logger.info(`OpenCompress v${VERSION} registered`);

    // 2. Start local proxy service
    api.registerService({
      id: "opencompress-proxy",
      start: () => {
        startProxy(
          () => getProviders(api),
          () => getApiKey(api),
        );
        api.logger.info(`OpenCompress proxy on ${PROXY_HOST}:${PROXY_PORT}`);
      },
      stop: () => {
        stopProxy();
      },
    });

    // Fallback: start proxy eagerly (registerService may not fire in --local mode)
    setTimeout(() => {
      try {
        startProxy(
          () => getProviders(api),
          () => getApiKey(api),
        );
      } catch {
        // Port already in use — fine
      }
    }, 1000);

    // 3. /cc-stats command
    api.registerCommand({
      name: "compress-stats",
      description: "Show OpenCompress savings and balance",
      handler: async () => {
        const key = getApiKey(api);
        if (!key) {
          return { text: "No API key. Run `openclaw onboard opencompress` first." };
        }

        try {
          const res = await fetch(`${OCC_API}/user/stats`, {
            headers: { Authorization: `Bearer ${key}` },
          });
          if (!res.ok) return { text: `Failed: HTTP ${res.status}` };

          const s = await res.json() as any;
          const balance = Number(s.balanceUsd || s.balance || 0);
          const calls = s.monthlyApiCalls ?? s.totalCalls ?? 0;
          const rate = s.avgCompressionRate ? `${(Number(s.avgCompressionRate) * 100).toFixed(1)}%` : "N/A";

          return {
            text: [
              "```",
              "🗜️ OpenCompress Stats",
              "======================",
              `Balance:         $${balance.toFixed(2)}`,
              `API calls:       ${calls}`,
              `Avg compression: ${rate}`,
              `Tokens saved:    ${(Number(s.totalOriginalTokens || 0) - Number(s.totalCompressedTokens || 0)).toLocaleString()}`,
              "```",
              "",
              balance < 0.5
                ? `⚠️ Low balance! Link account for $10 bonus: https://www.opencompress.ai/dashboard?link=${encodeURIComponent(key)}`
                : "Dashboard: https://www.opencompress.ai/dashboard",
            ].join("\n"),
          };
        } catch (err) {
          return { text: `Error: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    });

    // 4. /cc command (status)
    api.registerCommand({
      name: "compress",
      description: "Show OpenCompress status and available models",
      handler: async () => {
        const key = getApiKey(api);
        const providers = getProviders(api);
        const models = generateModelCatalog(providers);

        return {
          text: [
            "**OpenCompress**",
            "",
            `API key: ${key ? `${key.slice(0, 12)}...` : "not set — run \`openclaw onboard opencompress\`"}`,
            `Proxy: http://${PROXY_HOST}:${PROXY_PORT}`,
            "",
            "**Compressed models:**",
            ...models.map((m) => `  ${m.id}`),
            "",
            "Select any opencompress/* model to enable compression.",
          ].join("\n"),
        };
      },
    });
  },
};

export default plugin;
