<p align="center">
  <h1 align="center">Summoned AI Gateway</h1>
  <p align="center">
    <strong>Open-source AI gateway — 9 LLM providers behind a single OpenAI-compatible API.</strong>
  </p>
  <p align="center">
    <a href="#quick-start">Quick Start</a> &middot;
    <a href="#console">Console</a> &middot;
    <a href="#supported-providers">Providers</a> &middot;
    <a href="#features">Features</a> &middot;
    <a href="#how-to-use">How to Use</a> &middot;
    <a href="#contributing">Contributing</a>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
    <img src="https://img.shields.io/badge/bun-%3E%3D1.2-orange.svg" alt="Bun 1.2+" />
    <img src="https://img.shields.io/badge/OpenAI--compatible-yes-green.svg" alt="OpenAI Compatible" />
  </p>
</p>

---

Self-host your own AI gateway. Bring the provider API keys you already have — Summoned sits in front and adds intelligent routing, automatic failover, response caching, rate limiting, guardrails, and a built-in dashboard. **No code changes needed in your app.**

```
Your App  ──►  Summoned Gateway  ──►  OpenAI / Anthropic / Gemini / Groq / Bedrock / Ollama ...
                      │
                      ├── Intelligent routing (cost / latency)
                      ├── Automatic retries & fallbacks
                      ├── Circuit breaker per provider
                      ├── Response caching (Redis)
                      ├── Input/output guardrails (PII, regex, blocklists)
                      ├── Per-key rate limiting & daily token budgets
                      ├── Cost tracking per request (USD + INR)
                      └── Built-in console — logs, keys, playground
```

---

## Console

The gateway ships with a **built-in web console** — no separate app, no extra setup. It's served directly from the gateway at `/console`.

![Console demo](./assets/console-demo.gif)

### What's inside the console

| Page | What it does |
|---|---|
| **Dashboard** | Request volume, success rate, latency percentiles (p50/p95/p99), top models, cost over time |
| **Live Logs** | Real-time request stream via WebSocket — search, filter by status or provider, click any row to expand full details |
| **API Keys** | Create, list, and revoke `sk-smnd-...` keys without touching the CLI |
| **Virtual Keys** | Store provider API keys encrypted on the gateway — callers reference a virtual key ID, never the raw credential |
| **Providers** | Health status and circuit breaker state (CLOSED / OPEN / HALF_OPEN) for every registered provider |
| **Playground** | Send test completions to any model directly from the browser — see provider, latency, cost, and cache status in real-time |

> **Console auth:** Live Logs requires your `ADMIN_API_KEY` (enter it once — stored in `localStorage`). All other pages are accessible while served from the same origin.

---

## Quick Start

You need: [Bun](https://bun.sh) v1.2+, Docker, and at least one provider API key.

### Option 1 — Docker Compose (recommended)

```bash
git clone https://github.com/summoned-tech/summoned-ai-gateway.git
cd summoned-ai-gateway

cp .env.example .env
# Edit .env — minimum required:
#   ADMIN_API_KEY=<openssl rand -hex 32>
#   VIRTUAL_KEY_SECRET=<openssl rand -hex 32>
#   OPENAI_API_KEY=sk-...   (or any other provider key)

docker compose up -d
```

**Gateway** → `http://localhost:4200`
**Console** → `http://localhost:4200/console`

### Option 2 — Local with Make

```bash
git clone https://github.com/summoned-tech/summoned-ai-gateway.git
cd summoned-ai-gateway
make setup   # deps + Postgres + Redis + migrations + console build
make dev     # gateway with hot reload
```

### Option 3 — Manual

```bash
git clone https://github.com/summoned-tech/summoned-ai-gateway.git
cd summoned-ai-gateway
bun install
cp .env.example .env   # edit with your keys

docker run -d --name pg -p 5432:5432 \
  -e POSTGRES_USER=summoned -e POSTGRES_PASSWORD=summoned \
  -e POSTGRES_DB=summoned_gateway postgres:16-alpine
docker run -d --name redis -p 6379:6379 redis:7-alpine

bun run db:generate && bun run db:migrate
bun run dev
```

### First request

**Option A — pass your provider key directly (no gateway key needed):**

```bash
curl http://localhost:4200/v1/chat/completions \
  -H "x-provider-key: sk-YOUR_OPENAI_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o-mini", "messages": [{"role":"user","content":"Hello!"}]}'
```

**Option B — use a gateway-managed key (recommended for teams):**

```bash
# 1. Create a gateway key
curl -X POST http://localhost:4200/v1/keys \
  -H "x-admin-key: YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app", "tenantId": "team-a", "rateLimitRpm": 100}'

# 2. Use it — same as any OpenAI call
curl http://localhost:4200/v1/chat/completions \
  -H "Authorization: Bearer sk-smnd-YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello from Summoned!"}]
  }'
```

Or skip the CLI — open the console, go to **API Keys → Create Key**, then test in **Playground**.

---

## Supported Providers

| Provider | Model format | Example | Requires |
|---|---|---|---|
| **OpenAI** | `openai/<model>` | `openai/gpt-4o` | `OPENAI_API_KEY` |
| **Anthropic** | `anthropic/<model>` | `anthropic/claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| **Google Gemini** | `google/<model>` | `google/gemini-2.0-flash` | `GOOGLE_API_KEY` |
| **Groq** | `groq/<model>` | `groq/llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| **Azure OpenAI** | `azure/<deployment>` | `azure/gpt-4o` | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` |
| **AWS Bedrock** | `bedrock/<model>` | `bedrock/anthropic.claude-3-haiku-20240307-v1:0` | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` |
| **Ollama** | `ollama/<model>` | `ollama/llama3.2` | `OLLAMA_BASE_URL` (local, no key) |
| **Sarvam AI** | `sarvam/<model>` | `sarvam/sarvam-2b-v0.5` | `SARVAM_API_KEY` |
| **Yotta Labs** | `yotta/<model>` | `yotta/yotta-mini` | `YOTTA_API_KEY` |

> The gateway is a **pure proxy** — no static model catalog. Any model string your provider accepts works instantly. Zero config changes when new models launch.

---

## How to Use

### Drop in with the OpenAI SDK — zero new dependencies

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4200/v1",
    api_key="sk-smnd-...",
)

# Same code you already have — just change base_url and the model string
response = client.chat.completions.create(
    model="anthropic/claude-sonnet-4-20250514",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

Works with any OpenAI-compatible library: LangChain, LlamaIndex, CrewAI, Autogen, Vercel AI SDK, etc.

### Enable gateway features per request

All gateway features are controlled per request via the `x-summoned-config` header (base64 JSON) or the `config` body field:

```typescript
const response = await fetch("http://localhost:4200/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-smnd-...",
    "Content-Type": "application/json",
    "x-summoned-config": btoa(JSON.stringify({
      retry:    { attempts: 3, backoff: "exponential" },
      fallback: ["anthropic/claude-haiku-4", "groq/llama-3.3-70b-versatile"],
      cache:    true,
      routing:  "cost",           // or "latency"
      guardrails: {
        input:  [{ type: "pii", deny: true }],
      },
    })),
  },
  body: JSON.stringify({
    model: "openai/gpt-4o",
    messages: [{ role: "user", content: "Summarize this contract" }],
  }),
})
```

### Response headers

Every response includes:

```
X-Summoned-Provider:    openai
X-Summoned-Served-By:   openai/gpt-4o
X-Summoned-Cost-USD:    0.000150
X-Summoned-Latency-Ms:  432
X-Summoned-Cache:       MISS
X-Summoned-Trace-Id:    abc-123
X-Daily-Budget:         1000000
X-Daily-Used:           42300
X-Daily-Remaining:      957700
```

---

## Features

### Reliability

| Feature | How it works |
|---|---|
| **Automatic retries** | Exponential or linear backoff. Configurable attempts per request. |
| **Fallback models** | List alternate `provider/model` slugs. Gateway tries them in order on failure. |
| **Circuit breaker** | Per-provider. Opens after 5 failures, retries after 30s (HALF_OPEN). |
| **Request timeouts** | Per-request timeout with automatic cancellation. |
| **Intelligent routing** | `routing: "cost"` sorts providers cheapest-first. `routing: "latency"` sorts by observed EMA latency tracked in Redis. |

### Security

| Feature | How it works |
|---|---|
| **API key auth** | SHA-256 hashed `sk-smnd-...` keys. Redis-cached for fast lookups on every request. |
| **Rate limiting** | Per-key sliding-window RPM. IP-based for BYOK callers. Returns `429` with `Retry-After` header. |
| **Daily token budget** | Hard cap on `inputTokens + outputTokens` per key per day. Enforced atomically in Redis. Auto-resets at midnight. |
| **Virtual keys** | Provider credentials stored encrypted (AES-256-GCM via HKDF). Callers reference a `vk_...` ID. |
| **Guardrails** | Block PII (email, phone, SSN, Aadhaar, credit card), blocked words, regex patterns, length — on input and output. |
| **Timing-safe auth** | Admin key comparison is constant-time. Prevents timing attacks. |
| **Body size limit** | Requests over 4 MB rejected with `413`. |
| **Security headers** | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS (in production). |
| **Admin brute-force protection** | 20 req/min per IP on admin endpoints. Returns `429` on breach. |

### Performance

| Feature | How it works |
|---|---|
| **Response caching** | Redis-backed. Cache key = SHA-256 of (model + messages + params). Identical requests return cached responses instantly. |
| **Streaming** | Full SSE streaming on all 9 providers. |
| **Cost tracking** | Per-request cost in USD and INR. Shown in response headers, logs, and the console dashboard. |

### Observability

| Feature | How it works |
|---|---|
| **Live log stream** | WebSocket stream of every request. See provider, model, latency, cost, status in real-time. |
| **Prometheus metrics** | `/metrics` endpoint (admin-protected). Scrape with Grafana, Datadog, or any Prometheus-compatible tool. |
| **OpenTelemetry** | Distributed traces exported to any OTLP backend (Jaeger, Grafana Tempo, Honeycomb). |

---

## API Reference

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/v1/chat/completions` | POST | Gateway key or `x-provider-key` | OpenAI-compatible chat completion (streaming + tools) |
| `/v1/embeddings` | POST | Gateway key | Text embeddings |
| `/v1/models` | GET | — | List registered providers |
| `/v1/keys` | POST / GET / DELETE | `x-admin-key` | API key management |
| `/admin/virtual-keys` | POST / GET / DELETE | `x-admin-key` | Virtual key management |
| `/admin/logs` | GET | `x-admin-key` | Request logs |
| `/admin/stats` | GET | `x-admin-key` | Aggregated statistics |
| `/admin/providers` | GET | `x-admin-key` | Provider health + circuit breaker state |
| `/metrics` | GET | `x-admin-key` | Prometheus metrics |
| `/ws/logs` | WebSocket | `?key=ADMIN_KEY` | Real-time log streaming |
| `/health` | GET | — | Liveness check |
| `/health/ready` | GET | — | Readiness check (Postgres + Redis) |
| `/console` | GET | — | Built-in web console |

---

## Configuration

See [`.env.example`](.env.example) for the full list with links to each provider's key page.

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADMIN_API_KEY` | Yes | — | Master admin key (min 32 chars). `openssl rand -hex 32` |
| `VIRTUAL_KEY_SECRET` | Recommended | Falls back to `ADMIN_API_KEY` | Separate encryption key for virtual keys. `openssl rand -hex 32` |
| `POSTGRES_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection string |
| `GATEWAY_PORT` | No | `4200` | Port to listen on |
| `GATEWAY_REQUIRE_AUTH` | No | `true` | Set `false` to allow unauthenticated requests (trusted networks only) |
| `PUBLIC_RPM_LIMIT` | No | `60` | RPM cap for BYOK / unauthenticated callers |
| `OPENAI_API_KEY` | At least one provider | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | | — | Anthropic API key |
| `GOOGLE_API_KEY` | | — | Google Gemini API key |
| `GROQ_API_KEY` | | — | Groq API key |
| `AZURE_OPENAI_API_KEY` | | — | Azure OpenAI key + `AZURE_OPENAI_ENDPOINT` |
| `AWS_ACCESS_KEY_ID` | | — | AWS credentials for Bedrock |
| `OLLAMA_BASE_URL` | | — | Ollama server URL (no key needed) |
| `SARVAM_API_KEY` | | — | Sarvam AI key |
| `YOTTA_API_KEY` | | — | Yotta Labs key |
| `USD_INR_RATE` | No | `85` | Exchange rate for INR cost display |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | — | OpenTelemetry collector URL |

---

## Adding a New Provider

Takes **~10 lines of code** and **~5 minutes**:

**1.** Create `src/providers/your-provider.ts`:

```typescript
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

**2.** Add the env var to `src/lib/env.ts`:

```typescript
YOURPROVIDER_API_KEY: z.string().default(""),
```

**3.** Register in `src/index.ts`:

```typescript
if (env.YOURPROVIDER_API_KEY) {
  const { createYourProvider } = await import("@/providers/your-provider")
  registry.register(createYourProvider(env.YOURPROVIDER_API_KEY))
}
```

**4.** Add pricing to `src/lib/pricing.ts` (optional — zero cost shown if omitted).

See [CONTRIBUTING.md](CONTRIBUTING.md) for a full step-by-step walkthrough.

---

## Development

```bash
make setup          # Full setup: deps + Postgres + Redis + migrations + console build
make dev            # Gateway with hot reload
make dev-console    # Console Vite dev server with HMR
make console        # Rebuild console SPA
make check-types    # TypeScript type check
make migrate        # Generate + apply DB migrations
make create-key     # Quick-create an API key for testing
make help           # Show all commands
```

---

## Contributing

We welcome contributions. The easiest starting point is adding a new LLM provider — it's ~10 lines of code.

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- Architecture overview
- How to add a provider (step-by-step)
- How to add new features
- Code style guide

---

## License

[MIT](LICENSE) — free to use, fork, modify, and self-host. No restrictions.

---

<p align="center">
  Built by <a href="https://github.com/summoned-tech">Summoned Tech</a>
</p>
