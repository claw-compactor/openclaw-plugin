<p align="center">
  <br />
  <br />
  <strong><code>🗜️ OpenCompress</code></strong>
  <br />
  <em>for OpenClaw</em>
  <br />
  <br />
</p>

<h3 align="center">Your keys. Your models. Fewer tokens. Better quality.</h3>

<br />

<p align="center">
  <a href="https://www.npmjs.com/package/@opencompress/openclaw"><img src="https://img.shields.io/npm/v/@opencompress/openclaw?style=flat-square&color=000&label=npm" alt="npm" /></a>
  &nbsp;
  <a href="https://github.com/open-compress/opencompress-openclaw"><img src="https://img.shields.io/github/stars/open-compress/opencompress-openclaw?style=flat-square&color=000&label=stars" alt="stars" /></a>
  &nbsp;
  <a href="https://github.com/open-compress/opencompress-openclaw/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-000?style=flat-square" alt="license" /></a>
  &nbsp;
  <a href="https://openclaw.ai"><img src="https://img.shields.io/badge/OpenClaw-plugin-000?style=flat-square" alt="OpenClaw" /></a>
</p>

<br />

---

<p align="center">
OpenCompress is an <a href="https://openclaw.ai">OpenClaw</a> plugin that optimizes LLM input and output using a state-of-the-art multi-stage compression pipeline. It reduces token usage and improves response quality, automatically, on every call. Works with any provider you already use: Anthropic, OpenAI, Google, OpenRouter, and any OpenAI-compatible API.
</p>

---

<br />

We don't sell tokens. We don't resell API access.

You use your own keys, your own models, your own account. Billed directly by Anthropic, OpenAI, or whoever you choose. We compress the traffic so you get charged less and your agent thinks clearer.

Compression doesn't just save money. It removes the noise. Leaner prompts mean the model focuses on what matters. Shorter context, better answers, better code.

No vendor lock-in. Uninstall anytime. Everything goes back to exactly how it was.

<br />

---

<br />

### How it works

```
              ┌──────────────────────────────┐
              │     Your OpenClaw Agent      │
              │                              │
              │   model: opencompress/auto   │
              └──────────────┬───────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │     Local Proxy (:8401)      │
              │                              │
              │   reads your provider key    │
              │   from OpenClaw config       │
              └──────────────┬───────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │     opencompress.ai          │
              │                              │
              │   compress → forward         │
              │   your key in header         │
              │   never stored               │
              └──────────────┬───────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │     Your LLM Provider        │
              │     (Anthropic / OpenAI)     │
              │                              │
              │   sees fewer tokens          │
              │   charges you less           │
              └──────────────────────────────┘
```

<br />

---

<br />

### Install

```bash
openclaw plugins install @opencompress/openclaw
openclaw onboard opencompress
openclaw gateway restart
```

Select **`opencompress/auto`** as your model. Done.

<br />

### Models

Every provider you already have gets a compressed mirror:

```
opencompress/auto                          → your default, compressed
opencompress/anthropic/claude-sonnet-4     → Claude Sonnet, compressed
opencompress/anthropic/claude-opus-4-6     → Claude Opus, compressed
opencompress/openai/gpt-5.4               → GPT-5.4, compressed
```

Switch back to the original model anytime to disable compression.

<br />

### Commands

```
/compress-stats    view savings, balance, token metrics
/compress          show status and available models
```

<br />

---

<br />

### What we believe

<table>
<tr>
<td width="50%">

**Your keys are yours.**

We read your API key from OpenClaw's config at runtime, pass it in a per-request header, and discard it immediately. We never store, log, or cache your provider credentials. Ever.

</td>
<td width="50%">

**Your prompts are yours.**

Prompts are compressed in-memory and forwarded. Nothing is stored, logged, or used for training. The only thing we record is token counts for billing, original vs compressed. That's it.

</td>
</tr>
<tr>
<td>

**Zero lock-in.**

We don't replace your provider. We don't wrap your billing. If you uninstall, your agents keep working exactly as before. Same keys, same models, same everything.

</td>
<td>

**Failure is invisible.**

If our service goes down, your requests fall back directly to your provider. No errors, no downtime, no interruption. You just temporarily lose the compression savings.

</td>
</tr>
</table>

<br />

---

<br />

### Supported providers

```
Anthropic    Claude Sonnet, Opus, Haiku          anthropic-messages
OpenAI       GPT-5.x, o-series                   openai-completions
Google       Gemini                               openai-compat
OpenRouter   400+ models                          openai-completions
Any          OpenAI-compatible endpoint           openai-completions
```

<br />

### Pricing

Free credit on signup. No credit card. Pay only for the tokens you save.

**[Dashboard →](https://www.opencompress.ai/dashboard)**

<br />

---

<br />

<p align="center">
  <a href="https://www.opencompress.ai">opencompress.ai</a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://www.npmjs.com/package/@opencompress/openclaw">npm</a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="https://github.com/open-compress/opencompress-openclaw">github</a>
</p>

<p align="center">
  <sub>MIT License · OpenCompress</sub>
</p>

<br />

<!-- SEO: OpenClaw plugin, LLM token compression, save LLM tokens, reduce token cost, prompt compression, token optimization, reduce OpenClaw token usage, save API costs, LLM cost reduction, compress prompts, token savings, reduce AI costs, BYOK compression, OpenAI cost reduction, Anthropic cost reduction, Claude token savings, GPT token optimization, context compression, agentic compression, save money on LLM, reduce LLM bill, compress LLM context, openclaw cost savings -->
