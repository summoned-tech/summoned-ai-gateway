# Summoned AI Gateway

Sovereign AI infrastructure for India. Multi-provider, OpenAI-compatible gateway routing to 28+ LLM providers with auth, rate limiting, cost tracking, caching, guardrails, virtual keys, and audit logging.

## Architecture

- **Entry** (`src/index.ts`) — Hono server. Middleware: CORS → request-id → telemetry → auth → rate-limit. Providers registered dynamically at startup based on env vars.
- **Provider Abstraction** (`src/providers/base.ts`) — Minimal `ProviderAdapter` interface: `id`, `name`, `getModel()`, optional `getEmbeddingModel()`. No static model lists — gateway is a pure proxy.
- **Provider Registry** (`src/providers/registry.ts`) — Central registry. Resolves `provider/model` slugs to the correct adapter. No alias maps or static catalogs.
- **Providers** (`src/providers/`) — Bedrock, OpenAI, Anthropic, Google Gemini, Groq, Azure OpenAI, Ollama, Sarvam AI, Yotta Labs.
- **OpenAI-Compatible Base** (`src/providers/openai-compat.ts`) — Factory for any provider that speaks the OpenAI API format.
- **Routers** (`src/routers/`) — `completions.ts`, `embeddings.ts`, `admin.ts`, `keys.ts`, `virtual-keys.ts`, `health.ts`, `metrics.ts`.
- **Config** (`src/lib/config.ts`) — Per-request config via `x-summoned-config` header or `config` body field. Controls retry, fallback, timeout, caching, guardrails, virtual keys, metadata.
- **Pricing** (`src/lib/pricing.ts`) — Best-effort per-request cost in USD/INR. Decoupled from providers.
- **Cache** (`src/lib/cache.ts`) — Redis-backed response cache. Keyed by SHA-256 of (model + messages + params). Configurable TTL.
- **Guardrails** (`src/lib/guardrails.ts`) — Input/output validation: word deny lists, regex patterns, length limits, PII detection (email, phone, Aadhaar, SSN, credit card).
- **Virtual Keys** (`src/lib/provider-resolve.ts`, `src/routers/virtual-keys.ts`) — Encrypted provider credentials stored in DB. SDK users reference a virtual key ID instead of raw provider API keys.
- **Circuit Breaker** (`src/lib/circuit-breaker.ts`) — Per-provider circuit breaker (closed → open → half-open).
- **Log Buffer** (`src/lib/log-buffer.ts`) — In-memory ring buffer (1000 entries) for real-time log streaming via WebSocket.
- **Crypto** (`src/lib/crypto.ts`) — AES-256-GCM encryption for virtual key storage.
- **DB** (`src/db/schema.ts`) — `api_keys`, `virtual_keys`, `request_logs` (immutable audit trail with cost + cache tracking).
- **Telemetry** (`src/lib/telemetry/`) — OpenTelemetry tracing, Pino structured logging, Prometheus metrics.

## Design Principles

1. **Pure proxy** — No model ID validation. Upstream providers decide if the model exists.
2. **Provider = thin wrapper** — Each provider is 5-20 lines. AI SDK handles the heavy lifting.
3. **Pricing is a separate concern** — `pricing.ts`, keyed by `provider:model`. Missing = zero cost.
4. **Adding a provider takes 5 minutes** — Create file, add env var, register at startup.

## Providers

| Provider | Type | Env Var |
|---|---|---|
| AWS Bedrock | AI SDK `@ai-sdk/amazon-bedrock` | `AWS_BEDROCK_API_KEY` or IAM |
| OpenAI | AI SDK `@ai-sdk/openai` | `OPENAI_API_KEY` |
| Anthropic | AI SDK `@ai-sdk/anthropic` | `ANTHROPIC_API_KEY` |
| Google Gemini | AI SDK `@ai-sdk/google` | `GOOGLE_API_KEY` |
| Groq | OpenAI-compatible | `GROQ_API_KEY` |
| Azure OpenAI | OpenAI-compatible | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` |
| Ollama | OpenAI-compatible (local) | `OLLAMA_BASE_URL` |
| Sarvam AI | OpenAI-compatible (India) | `SARVAM_API_KEY` |
| Yotta Labs | OpenAI-compatible (India) | `YOTTA_API_KEY` |
| Mistral | OpenAI-compatible | `MISTRAL_API_KEY` |
| Together AI | OpenAI-compatible | `TOGETHER_API_KEY` |
| DeepSeek | OpenAI-compatible | `DEEPSEEK_API_KEY` |
| Fireworks AI | OpenAI-compatible | `FIREWORKS_API_KEY` |
| Cohere | OpenAI-compatible | `COHERE_API_KEY` |
| Cerebras | OpenAI-compatible | `CEREBRAS_API_KEY` |
| Perplexity | OpenAI-compatible | `PERPLEXITY_API_KEY` |
| xAI / Grok | OpenAI-compatible | `XAI_API_KEY` |
| OpenRouter | OpenAI-compatible (aggregator) | `OPENROUTER_API_KEY` |
| HuggingFace | OpenAI-compatible (router) | `HUGGINGFACE_API_KEY` |
| DeepInfra | OpenAI-compatible | `DEEPINFRA_API_KEY` |
| Hyperbolic | OpenAI-compatible | `HYPERBOLIC_API_KEY` |
| SambaNova | OpenAI-compatible | `SAMBANOVA_API_KEY` |
| Novita AI | OpenAI-compatible | `NOVITA_API_KEY` |
| Moonshot (Kimi) | OpenAI-compatible | `MOONSHOT_API_KEY` |
| Z.AI (GLM) | OpenAI-compatible | `ZAI_API_KEY` |
| Nvidia NIM | OpenAI-compatible | `NVIDIA_API_KEY` |
| vLLM | OpenAI-compatible (self-hosted) | `VLLM_BASE_URL` + optional `VLLM_API_KEY` |
| Voyage AI | OpenAI-compatible (embeddings/rerank) | `VOYAGE_API_KEY` |

## Model Format

Always use `provider/model-id`:
- `openai/gpt-4o`, `anthropic/claude-sonnet-4-20250514`, `groq/llama-3.3-70b-versatile`
- `bedrock/anthropic.claude-sonnet-4-20250514-v1:0`, `google/gemini-2.0-flash`

## API Surface

```
POST /v1/chat/completions        # Multi-provider, streaming + non-streaming
POST /v1/embeddings               # Multi-provider embeddings
GET  /v1/models                   # List registered providers
POST /v1/keys                     # Admin: create API key
GET  /v1/keys?tenantId=...        # Admin: list keys
DELETE /v1/keys/:id               # Admin: revoke key
POST /admin/virtual-keys          # Create virtual key (encrypted provider creds)
GET  /admin/virtual-keys?tenantId # List virtual keys
DELETE /admin/virtual-keys/:id    # Revoke virtual key
GET  /admin/logs                  # Recent logs (buffer or DB)
GET  /admin/stats                 # Aggregate stats (24h/7d/30d)
GET  /admin/providers             # Provider health + status
GET  /health                      # Liveness
GET  /health/ready                # Readiness
GET  /metrics                     # Prometheus metrics
WS   /ws/logs                     # Real-time log streaming
```

## Config (per-request)

Pass via `x-summoned-config` header (base64 JSON or raw JSON) or `config` field in request body:

```json
{
  "retry": { "attempts": 3, "backoff": "exponential" },
  "timeout": 30000,
  "fallback": ["groq/llama-3.3-70b-versatile"],
  "cache": true,
  "cacheTtl": 3600,
  "virtualKey": "vk_abc123",
  "traceId": "my-trace-id",
  "metadata": { "env": "production", "feature": "chatbot" },
  "guardrails": {
    "input": [
      { "type": "pii", "deny": true },
      { "type": "contains", "params": { "operator": "none", "words": ["password"] }, "deny": true }
    ],
    "output": [
      { "type": "contains", "params": { "operator": "none", "words": ["confidential"] }, "deny": true }
    ]
  }
}
```

## Response Headers

Every response includes:
- `X-Summoned-Provider` — which provider served the request
- `X-Summoned-Served-By` — model alias used
- `X-Summoned-Cost-USD` — estimated cost
- `X-Summoned-Latency-Ms` — total latency
- `X-Summoned-Trace-Id` — trace ID for correlation
- `X-Summoned-Cache` — `HIT` or `MISS`
- `X-RateLimit-Limit` / `X-RateLimit-Remaining` — rate limit info

## SDKs

### TypeScript (`@summoned/ai` — `summoned-sdk-ts/`)

```typescript
import { Summoned } from "@summoned/ai"

const client = new Summoned({ apiKey: "sk-smnd-..." })

const res = await client.chat.completions.create({
  model: "openai/gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
  config: { cache: true, fallback: ["anthropic/claude-sonnet-4-20250514"] },
})

// Streaming
for await (const chunk of await client.chat.completions.create({
  model: "openai/gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
  stream: true,
})) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "")
}
```

### Python (`summoned-ai` — `summoned-sdk-python/`)

```python
from summoned_ai import Summoned

client = Summoned(api_key="sk-smnd-...")

response = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
    config={"cache": True, "fallback": ["anthropic/claude-sonnet-4-20250514"]},
)

# Streaming
for chunk in client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True,
):
    print(chunk["choices"][0]["delta"].get("content", ""), end="")
```

## Running

```bash
bun run dev          # HTTP server on :4000
bun run db:migrate   # Apply migrations
```

## Adding a New Provider

1. Create `src/providers/{name}.ts` — use `createOpenAICompatProvider()` or implement `ProviderAdapter`.
2. Add env var to `src/lib/env.ts`.
3. Add registration block in `src/index.ts` `registerProviders()`.
4. (Optional) Add pricing entries to `src/lib/pricing.ts`.
5. (Optional) Add ephemeral provider case to `src/lib/provider-resolve.ts`.
