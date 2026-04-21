<h1 align="center">Summoned AI Gateway</h1>

<h3 align="center">
  Call 28 LLM providers through one OpenAI-compatible API.<br/>
  Self-host in <code>15 seconds</code>. Drop-in for <code>OpenAI</code>. Built for <code>India</code>.
</h3>

<p align="center">
  <code>npx @summoned/gateway</code> &middot;
  <code>docker run ghcr.io/summoned-tech/summoned-ai-gateway</code> &middot;
  <code>npm install @summoned/ai</code>
</p>

<p align="center">
  <a href="#quickstart--pick-one-gateway-up-in-15-seconds">Quickstart</a> &middot;
  <a href="#why-summoned">Why</a> &middot;
  <a href="#two-ways-to-use-summoned">Gateway vs SDK</a> &middot;
  <a href="#supported-providers">Providers</a> &middot;
  <a href="#core-features">Features</a> &middot;
  <a href="#console">Console</a> &middot;
  <a href="#community--support">Community</a>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <a href="https://www.npmjs.com/package/@summoned/gateway"><img src="https://img.shields.io/npm/v/@summoned/gateway.svg?color=cb3837&label=%40summoned%2Fgateway" alt="npm @summoned/gateway" /></a>
  <a href="https://www.npmjs.com/package/@summoned/ai"><img src="https://img.shields.io/npm/v/@summoned/ai.svg?color=cb3837&label=%40summoned%2Fai" alt="npm @summoned/ai" /></a>
  <a href="https://github.com/summoned-tech/summoned-ai-gateway/stargazers"><img src="https://img.shields.io/github/stars/summoned-tech/summoned-ai-gateway?style=social" alt="GitHub stars" /></a>
  <a href="https://github.com/summoned-tech/summoned-ai-gateway/issues"><img src="https://img.shields.io/github/issues/summoned-tech/summoned-ai-gateway?color=blue" alt="GitHub issues" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-green.svg" alt="Node 18+" />
  <img src="https://img.shields.io/badge/OpenAI--compatible-yes-green.svg" alt="OpenAI Compatible" />
  <img src="https://img.shields.io/badge/India--native-Sarvam%20%7C%20Yotta%20%7C%20Bedrock%20ap--south--1-orange.svg" alt="India native" />
</p>

<p align="center">
  <img src="./assets/console-demo.gif" alt="Summoned AI Gateway console demo" width="860" />
</p>

---

**Summoned** is a lightweight, open-source AI gateway that sits between your app and every major LLM provider. Bring your own provider keys — Summoned adds intelligent routing, automatic failover, response caching, cost governance, guardrails, and a full self-hosted console on top. **No code changes in your app.** Drop-in replacement for the OpenAI API.

<p align="center">
  <b>28 providers · OpenAI-compatible · MIT-licensed · DPDP-ready ap-south-1 · zero infra to start</b>
</p>

- [x] **28 providers, one API** — OpenAI, Anthropic, Google, AWS Bedrock, Azure, Groq, Mistral, DeepSeek, Together, Fireworks, Cohere, Cerebras, Perplexity, xAI, OpenRouter, HuggingFace, DeepInfra, Hyperbolic, SambaNova, Novita, Moonshot, Z.AI, Nvidia NIM, Ollama, vLLM, Voyage + India-first Sarvam and Yotta.
- [x] **Zero infra required** — runs completely stateless. Add Redis for caching + rate limits. Add Postgres for audit history.
- [x] **India-native** — Sarvam AI, Yotta Labs, AWS Bedrock `ap-south-1` (DPDP-compliant defaults), INR cost tracking.
- [x] **Full console, self-hosted, free** — dashboard, live logs, playground, cost analytics. No cloud subscription needed.
- [x] **Guardrails in the free tier** — PII blocking, content filters, regex rules. Competitors lock this behind enterprise.
- [x] **Virtual keys** — store provider credentials encrypted (AES-256-GCM). Callers reference a `vk_...` id; raw keys never leave the server.
- [x] **Versioned prompt management** — first OSS gateway with first-class, Postgres-backed prompt templates. `{{variables}}`, auto-incrementing versions, `prompt_id` on every audit log. [Portkey keeps this enterprise-only; LiteLLM's is in-memory](#prompt-management).
- [x] **Daily token budgets** — hard caps per API key. Critical for agents. Free.
- [x] **Official TypeScript SDK** — [`@summoned/ai`](https://www.npmjs.com/package/@summoned/ai) on npm.

#### What can you do?

- [x] Route to 28 providers through one endpoint — [Supported Providers](#supported-providers)
- [x] Zero downtime when a provider goes down — [Automatic Failover & Circuit Breakers](#reliability)
- [x] Route to the cheapest or fastest model automatically — [Intelligent Routing](#intelligent-routing)
- [x] Stop runaway agent loops before they drain your budget — [Daily Token Budgets](#cost-governance)
- [x] Cache repeated queries — [Response Caching](#performance)
- [x] Block PII, profanity, injection attempts — [Guardrails](#security)
- [x] See cost (USD + INR), latency, and token usage in real time — [Observability](#observability)
- [x] Encrypt and store provider keys on the gateway — [Virtual Keys](#security)
- [x] Works with OpenAI SDK, LangChain, LlamaIndex, CrewAI, Vercel AI SDK — [Framework Support](#works-with-any-framework)
- [x] Add any OpenAI-compatible provider in 5 lines — [Custom Providers](#adding-a-new-provider)

> [!TIP]
> Starring this repo helps more developers discover the gateway 🙏
>
> ⭐ **Star us on GitHub** — it takes 2 seconds and means a lot.

---

## Why Summoned

Building on top of LLMs gets messy fast. Every provider has its own SDK, auth, quirks, error types, and pricing. Your app ends up tangled in vendor-specific code, with no central place for retries, spend caps, PII scrubbing, or audit. **Summoned is the one place you put all of that.**

- **One API, every LLM.** Drop-in for OpenAI's SDK. Swap `openai/gpt-4o` for `anthropic/claude-sonnet-4-20250514` with a string change — no code rewrite.
- **Production-grade out of the box.** Retries, exponential backoff, provider fallback, circuit breakers, timeouts, and cost-or-latency-based routing ship enabled by default. Competitors gate these behind a paid tier.
- **Governance you can't skip.** Per-tenant daily token budgets, per-request PII/regex/length guardrails, AES-256-GCM encrypted virtual keys, timing-safe auth, immutable audit log — all free, self-hosted, MIT-licensed.
- **India-first.** Sarvam AI and Yotta Labs integrated as first-class providers. AWS Bedrock defaults to `ap-south-1` (DPDP-compliant). Per-request cost displayed in both USD and INR.
- **15-second to production.** `npx @summoned/gateway` to try locally. `docker run` to deploy. No clone required.

---

## Console

The gateway ships with a **built-in web console** at `/console` — no separate app, no extra services. The demo GIF above shows it end-to-end.

| Page | What you get |
|---|---|
| **Dashboard** | Requests, success rate, latency percentiles (p50/p95/p99), token volume, cost in USD + INR |
| **Live Logs** | Real-time WebSocket stream of every request — filter by status or provider, click to expand |
| **API Keys** | Create, list, and revoke `sk-smnd-...` keys from the browser |
| **Virtual Keys** | Store provider credentials encrypted (AES-256-GCM) — callers use a `vk_...` ID |
| **Providers** | Health status, circuit breaker state, avg latency per provider |
| **Playground** | Send test completions through **managed / virtual / BYOK** auth modes — see cost, latency, cache status live |

> **Access control**: the console and its API (`/console/api/*`) are protected by `ADMIN_API_KEY`. On first visit you'll be prompted for the key; it's stored in `localStorage` and sent on every request. Clicking "Sign out" clears it.

---

## Quickstart — pick one, gateway up in 15 seconds

### 🚀 npx (zero install)

```bash
ADMIN_API_KEY=$(openssl rand -hex 32) \
OPENAI_API_KEY=sk-... \
npx @summoned/gateway
```

> Gateway → `http://localhost:4000` · Console → `http://localhost:4000/console`

No clone, no Docker, no Bun — just Node 18+.

### 🐳 Docker (for production)

```bash
docker run -p 4000:4000 \
  -e ADMIN_API_KEY=$(openssl rand -hex 32) \
  -e OPENAI_API_KEY=sk-... \
  ghcr.io/summoned-tech/summoned-ai-gateway:latest
```

### 🛠 Full stack with Postgres + Redis (persistent logs + managed keys)

```bash
git clone https://github.com/summoned-tech/summoned-ai-gateway.git
cd summoned-ai-gateway

cp .env.example .env
# Edit .env — set ADMIN_API_KEY + POSTGRES_URL + REDIS_URL + provider keys

docker compose up -d
```

Or for local dev with hot reload:
```bash
make setup   # deps + Postgres + Redis + migrations + console build
make dev     # gateway with hot reload via Bun
```

**What works without Postgres / Redis:**

| Feature | No Postgres | No Redis | Both absent |
|---|---|---|---|
| Chat completions | ✅ | ✅ | ✅ |
| Streaming | ✅ | ✅ | ✅ |
| Guardrails | ✅ | ✅ | ✅ |
| Fallback / circuit breaker | ✅ | ✅ | ✅ |
| Response caching | ✅ | in-memory | in-memory |
| Rate limiting | ✅ | in-memory | in-memory |
| Managed API keys | ❌ | ✅ | ❌ |
| Request history / analytics console | ❌ | ✅ | ❌ |
| Virtual key encryption | ❌ | ✅ | ❌ |

### 2. Make your first request

> **Option A — pass your provider key directly (no gateway key needed):**

```bash
curl http://localhost:4200/v1/chat/completions \
  -H "x-provider-key: sk-YOUR_OPENAI_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o-mini", "messages": [{"role":"user","content":"Hello!"}]}'
```

> **Option B — use a gateway-managed key (recommended for teams):**

```bash
# Create a key
curl -X POST http://localhost:4200/v1/keys \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app", "tenantId": "team-a"}'

# Use it
curl http://localhost:4200/v1/chat/completions \
  -H "Authorization: Bearer sk-smnd-YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o-mini", "messages": [{"role":"user","content":"Hello!"}]}'
```

### 3. Add gateway features

Control retries, fallbacks, caching, routing, and guardrails **per request** via the `x-summoned-config` header (or the SDK's `config` field):

```python
import json, base64
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4200/v1",
    api_key="sk-smnd-...",
)

config = {
    "retry":    { "attempts": 3, "backoff": "exponential" },
    "fallback": ["anthropic/claude-haiku-4", "groq/llama-3.3-70b-versatile"],
    "cache":    True,
    "routing":  "cost",   # cheapest provider first
    "guardrails": {
        "input": [{ "type": "pii", "deny": True }]
    }
}

response = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Summarize this contract"}],
    extra_headers={
        "x-summoned-config": base64.b64encode(json.dumps(config).encode()).decode()
    }
)
```

Works with any OpenAI-compatible library — **LangChain, LlamaIndex, CrewAI, Autogen, Vercel AI SDK** and more.

---

## Two ways to use Summoned

Pick the one that fits what you're building. Both are MIT-licensed, on npm, and production-ready.

|  | `@summoned/gateway` | `@summoned/ai` |
|---|---|---|
| **What it is** | The gateway server itself. Runs somewhere (your laptop, a VM, Docker, AWS). | The typed client SDK your app imports. Talks to a gateway over HTTP. |
| **Who installs it** | Platform / DevOps / ML infra teams. Runs once per environment. | Every developer on the team. One per app. |
| **When to use** | You want retries, fallback, caching, guardrails, virtual keys, budgets, audit, and a console — all on a server you control. | You want a type-safe way to call a gateway (ours or a self-hosted one) from TypeScript. |
| **Try in 15s** | `npx @summoned/gateway` | `npm install @summoned/ai` |
| **Works with** | Node 18+ (via npx) · Bun 1.2+ · Docker · any cloud that runs containers | Any OpenAI-compatible library — or use the SDK directly for full typed config. |
| **Source** | [`summoned-ai-gateway`](https://github.com/summoned-tech/summoned-ai-gateway) | [`summoned-sdk-ts`](https://github.com/summoned-tech/summoned-sdk-ts) |

If you only want to call LLMs from your app and don't want to run infra, use the SDK against someone else's Summoned gateway (e.g. one you already deployed). If you're standing up AI infra for a team, run the gateway and point the SDK at it.

---

## Use from your code

The official **TypeScript SDK** ships on npm. It's a thin typed wrapper around the OpenAI-compatible surface, plus first-class support for the `config` object (retry / fallback / cache / guardrails / virtual keys).

```bash
npm install @summoned/ai
```

```typescript
import { Summoned } from "@summoned/ai"

const client = new Summoned({
  apiKey: "sk-smnd-...",
  baseURL: "http://localhost:4200",
})

const res = await client.chat.completions.create({
  model: "openai/gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
  config: {
    cache: true,
    fallback: ["anthropic/claude-sonnet-4-20250514", "groq/llama-3.3-70b-versatile"],
    routing: "cost",
  },
})

console.log(res.choices[0].message.content)
console.log(res.summoned) // { provider, cost, latency_ms, ... }
```

Streaming:

```typescript
for await (const chunk of await client.chat.completions.create({
  model: "openai/gpt-4o",
  messages: [{ role: "user", content: "Write a haiku" }],
  stream: true,
})) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "")
}
```

Prefer the OpenAI SDK? Point it at the gateway:

```typescript
import OpenAI from "openai"
const openai = new OpenAI({
  baseURL: "http://localhost:4200/v1",
  apiKey: "sk-smnd-...",
})
```

> **Package**: [`@summoned/ai`](https://www.npmjs.com/package/@summoned/ai) · ESM-only · Node 18+ · ~13 KB tarball.

---

## Supported Providers

28 providers out of the box. Every provider listed here is enabled by setting its env var — unset ones are simply skipped at startup, so you only pay for the surface you use.

| Provider | Model format | Example | Env var |
|---|---|---|---|
| **OpenAI** | `openai/<model>` | `openai/gpt-4o` | `OPENAI_API_KEY` |
| **Anthropic** | `anthropic/<model>` | `anthropic/claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| **Google Gemini** | `google/<model>` | `google/gemini-2.0-flash` | `GOOGLE_API_KEY` |
| **AWS Bedrock** | `bedrock/<model>` | `bedrock/amazon.nova-pro-v1:0` | AWS creds / `AWS_BEDROCK_API_KEY` |
| **Azure OpenAI** | `azure/<deployment>` | `azure/gpt-4o` | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` |
| **Groq** | `groq/<model>` | `groq/llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| **Mistral AI** | `mistral/<model>` | `mistral/mistral-large-latest` | `MISTRAL_API_KEY` |
| **Together AI** | `together/<model>` | `together/meta-llama/Llama-3.3-70B-Instruct-Turbo` | `TOGETHER_API_KEY` |
| **DeepSeek** | `deepseek/<model>` | `deepseek/deepseek-chat` | `DEEPSEEK_API_KEY` |
| **Fireworks AI** | `fireworks/<model>` | `fireworks/accounts/fireworks/models/llama-v3p1-70b-instruct` | `FIREWORKS_API_KEY` |
| **Cohere** | `cohere/<model>` | `cohere/command-r-plus` | `COHERE_API_KEY` |
| **Cerebras** | `cerebras/<model>` | `cerebras/llama3.1-70b` | `CEREBRAS_API_KEY` |
| **Perplexity** | `perplexity/<model>` | `perplexity/llama-3.1-sonar-large-128k-online` | `PERPLEXITY_API_KEY` |
| **xAI (Grok)** | `xai/<model>` | `xai/grok-3` | `XAI_API_KEY` |
| **OpenRouter** | `openrouter/<upstream>/<model>` | `openrouter/openai/gpt-4o` | `OPENROUTER_API_KEY` |
| **HuggingFace** | `huggingface/<model>` | `huggingface/meta-llama/Llama-3.3-70B-Instruct` | `HUGGINGFACE_API_KEY` |
| **DeepInfra** | `deepinfra/<model>` | `deepinfra/meta-llama/Meta-Llama-3.1-70B-Instruct` | `DEEPINFRA_API_KEY` |
| **Hyperbolic** | `hyperbolic/<model>` | `hyperbolic/deepseek-ai/DeepSeek-V3` | `HYPERBOLIC_API_KEY` |
| **SambaNova** | `sambanova/<model>` | `sambanova/Meta-Llama-3.1-405B-Instruct` | `SAMBANOVA_API_KEY` |
| **Novita AI** | `novita/<model>` | `novita/meta-llama/llama-3.1-70b-instruct` | `NOVITA_API_KEY` |
| **Moonshot (Kimi)** | `moonshot/<model>` | `moonshot/moonshot-v1-128k` | `MOONSHOT_API_KEY` |
| **Z.AI (GLM)** | `zai/<model>` | `zai/glm-4.5` | `ZAI_API_KEY` |
| **Nvidia NIM** | `nvidia/<model>` | `nvidia/meta/llama-3.1-405b-instruct` | `NVIDIA_API_KEY` |
| **Ollama** | `ollama/<model>` | `ollama/llama3.2` | `OLLAMA_BASE_URL` (local, no key) |
| **vLLM** | `vllm/<model>` | `vllm/meta-llama/Llama-3-70B-Instruct` | `VLLM_BASE_URL` (+ optional `VLLM_API_KEY`) |
| **Voyage AI** | `voyage/<model>` | `voyage/voyage-3-large` | `VOYAGE_API_KEY` (embeddings / rerank) |
| **Sarvam AI** 🇮🇳 | `sarvam/<model>` | `sarvam/sarvam-2b-v0.5` | `SARVAM_API_KEY` |
| **Yotta Labs** 🇮🇳 | `yotta/<model>` | `yotta/yotta-mini` | `YOTTA_API_KEY` |

> **Pure proxy** — no static model catalog. Any model the upstream provider accepts works immediately, zero config changes when new models launch.
>
> **Any OpenAI-compatible provider** — use `CUSTOM_PROVIDERS` to add any private endpoint in JSON config. No code changes needed.

---

## Works with any framework

Summoned exposes the OpenAI Chat Completions + Embeddings API verbatim, so anything that speaks OpenAI works unchanged. All `@summoned/*` features (retry, fallback, cache, guardrails, budgets) are available through every route below — either via the `x-summoned-config` header or the native SDK `config` field.

| Framework / Library | How to point at Summoned | Gateway features available |
|---|---|---|
| **@summoned/ai** (recommended) | `new Summoned({ apiKey, baseURL })` | ✅ all, with first-class typed `config` |
| **OpenAI SDK** (Node / Python) | `baseURL: "<gateway>/v1"` | ✅ all, via `x-summoned-config` header |
| **Vercel AI SDK** | `createOpenAI({ baseURL: "<gateway>/v1" })` | ✅ all |
| **LangChain** (Python / JS) | `ChatOpenAI(base_url="<gateway>/v1", …)` | ✅ all |
| **LlamaIndex** (Python / JS) | `OpenAI(base_url="<gateway>/v1", …)` | ✅ all |
| **CrewAI** | set `OPENAI_BASE_URL=<gateway>/v1` | ✅ all |
| **Autogen / AG2** | set `OPENAI_BASE_URL=<gateway>/v1` | ✅ all |
| **LiteLLM SDK** (upstream) | `model="openai/..." base_url=<gateway>/v1` | ✅ all |
| **Cursor / Continue / any IDE** | set OpenAI-compatible base URL | ✅ all |
| **curl / Postman / raw HTTP** | `POST <gateway>/v1/chat/completions` | ✅ all |

<details>
<summary><b>Snippets — one per framework</b></summary>

```typescript
// @summoned/ai (official)
import { Summoned } from "@summoned/ai"
const client = new Summoned({ apiKey: "sk-smnd-...", baseURL: "http://localhost:4000" })

// OpenAI SDK (Node)
import OpenAI from "openai"
const openai = new OpenAI({ baseURL: "http://localhost:4000/v1", apiKey: "sk-smnd-..." })

// Vercel AI SDK
import { createOpenAI } from "@ai-sdk/openai"
const openai = createOpenAI({ baseURL: "http://localhost:4000/v1", apiKey: "sk-smnd-..." })
```

```python
# LangChain
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(base_url="http://localhost:4000/v1", api_key="sk-smnd-...")

# LlamaIndex
from llama_index.llms.openai import OpenAI
llm = OpenAI(base_url="http://localhost:4000/v1", api_key="sk-smnd-...")

# CrewAI / Autogen — just set OPENAI_BASE_URL=http://localhost:4000/v1
```

</details>

---

## Core Features

### Reliability

| Feature | How it works |
|---|---|
| **Automatic retries** | Exponential or linear backoff. Configurable attempts per request. |
| **Fallback models** | Specify alternate `provider/model` slugs. Gateway tries them in order on failure. |
| **Circuit breaker** | Per-provider. Opens after 5 consecutive failures, retries after 30s in HALF_OPEN state. |
| **Request timeouts** | Per-request timeout with automatic cancellation and graceful SSE termination. |

### Intelligent Routing

| Strategy | How it works |
|---|---|
| `"routing": "cost"` | Sorts model chain by input token price — cheapest first. |
| `"routing": "latency"` | Sorts by observed Exponential Moving Average latency per provider (stored in Redis). |
| `"routing": "default"` | Uses the order you specified in `fallback_models`. |

### Cost Governance

| Feature | How it works |
|---|---|
| **Daily token budget (TPD)** | Hard cap on `inputTokens + outputTokens` per API key per day. Enforced atomically in Redis. Returns `429 BUDGET_EXCEEDED` when exceeded. Auto-resets at midnight. |
| **Per-key rate limiting** | Requests per minute (RPM) sliding window per `sk-smnd-...` key. IP-based for BYOK callers. |
| **Cost tracking** | Per-request cost in USD and INR. In response headers, live logs, and dashboard. Unknown-model costs are flagged `priceUnknown: true` rather than silently reported as $0. |

### Security

| Feature | How it works |
|---|---|
| **API key auth** | SHA-256 hashed `sk-smnd-...` keys. Redis-cached for fast lookups. |
| **Virtual key encryption** | Provider credentials stored with AES-256-GCM via HKDF. Callers reference `vk_...` ID. Cache invalidated immediately on revoke. |
| **Guardrails** | Block PII (email, phone, SSN, Aadhaar, credit card), blocked words, regex, length — on input and output. |
| **Timing-safe auth** | Admin + API key comparison is constant-time. Timing attack resistant. |
| **Body size limit** | Requests over 4 MB rejected with `413`. |
| **Security headers** | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS (in production). |
| **Admin brute-force protection** | 20 req/min per IP on admin + console endpoints. |
| **Console lockdown** | `/console/api/*` requires `x-admin-key` on every request; CORS scoped to `/v1` and `/health` only. |
| **BYOK mode** | Pass provider key via `x-provider-key` header. No gateway key required. IP-rate-limited. |

### Prompt Management

Versioned prompt templates, stored on the gateway. Reference by slug + version
from any client — curl, OpenAI SDK, Summoned SDK — and never redeploy an app
just to change a system prompt again.

```bash
# Create v1 of a prompt
curl -X POST http://localhost:4000/admin/prompts \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "slug": "customer-support",
    "tenantId": "default",
    "template": [
      {"role": "system", "content": "You are a {{tone}} support agent."},
      {"role": "user",   "content": "{{user_question}}"}
    ],
    "variables": { "tone": "friendly" },
    "defaultModel": "openai/gpt-4o"
  }'

# Use it in any completion (the template is interpolated + prepended)
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-smnd-..." \
  -H "content-type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [],
    "config": {
      "promptId": "customer-support",
      "promptVariables": { "user_question": "Where is my order?" }
    }
  }'
```

| Feature | How it works |
|---|---|
| **Versioned templates** | `POST /admin/prompts` with the same `slug` auto-increments the version. Use `"promptId": "slug@3"` to pin, or bare `"slug"` for latest. |
| **Variable interpolation** | `{{name}}` placeholders are replaced from `config.promptVariables` (caller) or the template's `variables` (defaults). Missing variables survive literally so bugs are visible. |
| **Default model** | Prompts can pin a model. Caller-specified `model` always wins. |
| **Audit trail** | Every request logs which `prompt_id` + `prompt_version` was used. |
| **Zero lock-in** | Just a Postgres table. Drizzle schema in-repo. Export with `pg_dump`; portable to anywhere. |

_Other gateways charge for this or keep it in-memory. We don't._ See
[`rfcs/0001-prompt-management.md`](./rfcs/0001-prompt-management.md) for the
design, or the Console's **Prompts** tab for the UI.

### Performance

| Feature | How it works |
|---|---|
| **Response caching** | Redis-backed (in-memory fallback). Cache key = SHA-256 of (model + messages + params). Identical requests served instantly. |
| **Full streaming** | SSE streaming across every provider, with fallback-before-first-chunk and clean `[DONE]` termination on error. |

### Observability

| Feature | How it works |
|---|---|
| **Live log stream** | WebSocket stream. Every request logged with provider, model, latency, cost, status. |
| **Prometheus metrics** | `/metrics` endpoint (admin-protected). Scrape with Grafana, Datadog, Prometheus. |
| **OpenTelemetry** | Distributed traces exported to any OTLP backend (Jaeger, Grafana Tempo, Honeycomb). |
| **Response headers** | `X-Summoned-Provider`, `X-Summoned-Cost-USD`, `X-Summoned-Latency-Ms`, `X-Summoned-Cache`, `X-Daily-Remaining` on every response. |

---

## API Reference

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/v1/chat/completions` | POST | `Bearer` or `x-provider-key` | OpenAI-compatible completion (streaming + tools) |
| `/v1/embeddings` | POST | `Bearer` | Text embeddings |
| `/v1/models` | GET | — | List registered providers |
| `/v1/keys` | POST / GET / DELETE | `x-admin-key` | API key management |
| `/admin/virtual-keys` | POST / GET / DELETE | `x-admin-key` | Virtual key management |
| `/admin/prompts` | POST / GET / DELETE | `x-admin-key` | Versioned prompt templates |
| `/admin/logs` | GET | `x-admin-key` | Request logs (buffer or DB) |
| `/admin/stats` | GET | `x-admin-key` | Aggregated statistics |
| `/admin/providers` | GET | `x-admin-key` | Provider health + circuit breaker state |
| `/console/api/*` | * | `x-admin-key` | Admin API used by the web console (same surface as `/admin`) |
| `/metrics` | GET | `x-admin-key` | Prometheus metrics |
| `/ws/logs` | WebSocket | `?key=ADMIN_KEY` | Real-time log streaming |
| `/health` | GET | — | Liveness check |
| `/health/ready` | GET | — | Readiness (Postgres + Redis) |
| `/console` | GET | `ADMIN_API_KEY` (in browser prompt) | Built-in web console |

---

## Configuration

See [`.env.example`](.env.example) for the full reference.

### Core

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADMIN_API_KEY` | Yes | — | Master admin key (min 32 chars). `openssl rand -hex 32` |
| `VIRTUAL_KEY_SECRET` | Recommended | Falls back to admin key | Encryption key for virtual keys. `openssl rand -hex 32` |
| `GATEWAY_PORT` | No | `4000` | Port to listen on (`.env.example` sets `4200`) |
| `GATEWAY_REQUIRE_AUTH` | No | `true` | Set `false` for trusted private networks |
| `PUBLIC_RPM_LIMIT` | No | `60` | RPM cap for BYOK / unauthenticated callers |
| `POSTGRES_URL` | Optional | — | Enables managed keys, virtual keys, audit history |
| `REDIS_URL` | Optional | — | Enables cache, rate limits, latency EMA |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | — | OpenTelemetry trace endpoint |
| `USD_INR_RATE` | No | `85` | Exchange rate for INR cost display |

### Provider credentials

Set only the ones you plan to use — unset providers are skipped at startup.

| Variable | Provider |
|---|---|
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `GOOGLE_API_KEY` | Google Gemini |
| `GROQ_API_KEY` | Groq |
| `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` | Azure OpenAI |
| `AWS_ACCESS_KEY_ID` / `AWS_BEDROCK_API_KEY` + `AWS_REGION` | AWS Bedrock |
| `MISTRAL_API_KEY` | Mistral AI |
| `TOGETHER_API_KEY` | Together AI |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `FIREWORKS_API_KEY` | Fireworks AI |
| `COHERE_API_KEY` | Cohere |
| `CEREBRAS_API_KEY` | Cerebras |
| `PERPLEXITY_API_KEY` | Perplexity |
| `XAI_API_KEY` | xAI / Grok |
| `OPENROUTER_API_KEY` | OpenRouter |
| `HUGGINGFACE_API_KEY` | HuggingFace |
| `DEEPINFRA_API_KEY` | DeepInfra |
| `HYPERBOLIC_API_KEY` | Hyperbolic |
| `SAMBANOVA_API_KEY` | SambaNova |
| `NOVITA_API_KEY` | Novita AI |
| `MOONSHOT_API_KEY` | Moonshot (Kimi) |
| `ZAI_API_KEY` | Z.AI (Zhipu / GLM) |
| `NVIDIA_API_KEY` | Nvidia NIM |
| `OLLAMA_BASE_URL` | Ollama (local) |
| `VLLM_BASE_URL` (+ optional `VLLM_API_KEY`) | vLLM (self-hosted) |
| `VOYAGE_API_KEY` | Voyage AI |
| `SARVAM_API_KEY` 🇮🇳 | Sarvam AI |
| `YOTTA_API_KEY` 🇮🇳 | Yotta Labs |
| `CUSTOM_PROVIDERS` | JSON array `[{id,name,baseUrl,apiKey}]` for any OpenAI-compatible endpoint |

---

## Adding a New Provider

Takes **~10 lines of code** and **~5 minutes** if the provider speaks the OpenAI API format:

```typescript
// src/providers/your-provider.ts
import { createOpenAICompatProvider } from "./openai-compat"

export function createYourProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "yourprovider",
    name: "Your Provider",
    apiKey,
    baseURL: "https://api.yourprovider.com/v1",
  })
}
```

Then add the env var in `src/lib/env.ts`, register it in `src/index.ts`, and optionally add pricing in `src/lib/models/your-provider.ts`. See [CONTRIBUTING.md](CONTRIBUTING.md) for a full walkthrough.

---

## Development

```bash
make setup          # Full setup: deps + Postgres + Redis + migrations + console
make dev            # Gateway with hot reload
make dev-console    # Console Vite dev server
make check-types    # TypeScript type check
make migrate        # Run DB migrations
make create-key     # Quick-create an API key for testing
make help           # All commands
```

Run the test suite:

```bash
bun test tests      # ~45 tests across pricing, guardrails, fallback, config, circuit breaker
```

---

## SDKs

| Language | Package | Source |
|---|---|---|
| TypeScript / JavaScript | [`@summoned/ai`](https://www.npmjs.com/package/@summoned/ai) | [`summoned-sdk-ts`](https://github.com/summoned-tech/summoned-sdk-ts) |
| Python | `summoned-ai` (PyPI) | [`summoned-sdk-python`](https://github.com/summoned-tech/summoned-sdk-python) |

---

## Contributing

The easiest way to contribute is to **add a new LLM provider** — it's ~10 lines of code and ~5 minutes. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full walkthrough.

Other good first contributions:
- Improve a provider's pricing catalog in `src/lib/models/`
- Add a guardrail type (prompt-injection classifier, jailbreak detection, etc.)
- Port the console to a new page (usage/billing, prompt playground, model catalog)
- Write an integration guide for a framework we don't document yet

---

## Community & Support

We just launched publicly — come say hi and tell us what to build next.

| Channel | For | Link |
|---|---|---|
| **GitHub Issues** | Bugs, security reports, install problems | [Open an issue →](https://github.com/summoned-tech/summoned-ai-gateway/issues/new/choose) |
| **GitHub Discussions** | Feature requests, Q&A, "what should I do?" questions | [Start a thread →](https://github.com/summoned-tech/summoned-ai-gateway/discussions) |
| **Security** | Vulnerabilities, responsible disclosure | <a href="mailto:security@summoned.tech">security@summoned.tech</a> |
| **Hello / feedback** | General questions, integration help, partnerships | <a href="mailto:hello@summoned.tech">hello@summoned.tech</a> |
| **Star the repo ⭐** | The single best way to help us reach more developers | [Star on GitHub →](https://github.com/summoned-tech/summoned-ai-gateway/stargazers) |

If you're running Summoned in production, we'd love to hear about it — send a quick note to `hello@summoned.tech` and we'll list you (with permission) in the adopters section.

---

## License

[MIT](LICENSE) — free to use, fork, modify, and self-host. Commercial use explicitly permitted.

---

<p align="center">
  <strong>Built by <a href="https://github.com/summoned-tech">Summoned Tech</a></strong>
  <br />
  <sub>Made with ♥ for developers who care about production AI infra</sub>
</p>
