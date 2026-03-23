/**
 * Dynamic model resolution — parse opencompress/* model IDs
 * and resolve upstream provider + key from user's existing config.
 */

export interface UpstreamInfo {
  upstreamProvider: string;
  upstreamModel: string;
  upstreamKey: string | undefined;
  upstreamBaseUrl: string;
  upstreamApi: string;
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey?: string;
  api?: string;
  models?: Array<{ id: string; name: string; [k: string]: unknown }>;
  [k: string]: unknown;
}

/**
 * Resolve opencompress/provider/model → upstream provider info.
 *
 * Formats:
 *   opencompress/auto                      → first available provider, first model
 *   opencompress/anthropic/claude-sonnet-4  → specific provider + model
 *   opencompress/openai/gpt-5.4            → specific provider + model
 */
export function resolveUpstream(
  modelId: string,
  providers: Record<string, ProviderConfig>,
): UpstreamInfo | null {
  const stripped = modelId.replace(/^opencompress\//, "");

  if (stripped === "auto") {
    // Find first non-opencompress provider
    for (const [id, config] of Object.entries(providers)) {
      if (id === "opencompress") continue;
      const firstModel = config.models?.[0]?.id;
      if (!firstModel) continue;
      return {
        upstreamProvider: id,
        upstreamModel: firstModel,
        upstreamKey: config.apiKey,
        upstreamBaseUrl: config.baseUrl,
        upstreamApi: config.api || "openai-completions",
      };
    }
    return null;
  }

  // Parse provider/model
  const slashIdx = stripped.indexOf("/");
  if (slashIdx === -1) {
    // Just provider name, no model — use first model
    const config = providers[stripped];
    if (!config) return null;
    return {
      upstreamProvider: stripped,
      upstreamModel: config.models?.[0]?.id || stripped,
      upstreamKey: config.apiKey,
      upstreamBaseUrl: config.baseUrl,
      upstreamApi: config.api || "openai-completions",
    };
  }

  const upstreamProvider = stripped.slice(0, slashIdx);
  const upstreamModel = stripped.slice(slashIdx + 1);
  const config = providers[upstreamProvider];

  if (!config) return null;

  return {
    upstreamProvider,
    upstreamModel,
    upstreamKey: config.apiKey,
    upstreamBaseUrl: config.baseUrl,
    upstreamApi: config.api || "openai-completions",
  };
}

/**
 * Generate model catalog from user's existing providers.
 * For each existing model, create an opencompress/* variant.
 */
export function generateModelCatalog(
  providers: Record<string, ProviderConfig>,
): Array<{ id: string; name: string; api: string; [k: string]: unknown }> {
  const models: Array<{ id: string; name: string; api: string; [k: string]: unknown }> = [];

  for (const [providerId, config] of Object.entries(providers)) {
    if (providerId === "opencompress") continue;

    for (const model of config.models || []) {
      models.push({
        ...model,
        id: `opencompress/${providerId}/${model.id}`,
        name: `${model.name || model.id} (compressed)`,
        api: config.api || "openai-completions",
      });
    }
  }

  // Always add auto model
  models.unshift({
    id: "opencompress/auto",
    name: "OpenCompress Auto (compressed, uses default provider)",
    api: "openai-completions",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 8192,
  });

  return models;
}
