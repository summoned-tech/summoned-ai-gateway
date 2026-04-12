<p align="center">
  <h1 align="center">Summoned AI Gateway</h1>
  <p align="center">
    <strong>Open-source AI gateway that unifies 10+ LLM providers behind a single OpenAI-compatible API.</strong>
  </p>
  <p align="center">
    <a href="#quick-start">Quick Start</a> &middot;
    <a href="#supported-providers">Providers</a> &middot;
    <a href="#console">Console</a> &middot;
    <a href="#sdks">SDKs</a> &middot;
    <a href="#contributing">Contributing</a>
  </p>
</p>

---

Drop-in replacement for the OpenAI API. Switch between OpenAI, Anthropic, Gemini, Groq, Bedrock, and more — with automatic retries, fallbacks, caching, guardrails, and cost tracking — **without changing a single line of your application code.**

```
Your App  ──>  Summoned Gateway  ──>  OpenAI / Anthropic / Gemini / Groq / Azure / Bedrock / Ollama ...
                     |
                     |── Automatic retries & fallbacks
                     |── Response caching (Redis)
                     |── Input/output guardrails (PII, regex, blocklists)
                     |── Per-tenant API keys & rate limiting
                     |── Cost tracking (USD + INR)
                     |── Circuit breaker per provider
                     |── Built-in console with live logs
                     \── Real-time WebSocket log streaming
```

### Why Summoned?

- **Zero lock-in** — Uses the standard OpenAI API format. Your existing code works as-is.
- **Pure proxy** — No static model catalog. Any model the upstream provider supports works instantly. Zero maintenance when new models launch.
- **Built-in console** — Dashboard, live logs, key management, and a playground — all served from the gateway itself. No extra setup.
- **5-minute setup** — Clone, add one API key, `docker compose up`. Done.
- **Add a provider in 10 lines** — Each provider is a thin wrapper. See [Adding a New Provider](#adding-a-new-provider).

---

## Quick Start

### Option 1: Docker Compose (recommended)

```bash
git clone https://github.com/summoned-tech/summoned-ai-gateway.git
cd summoned-ai-gateway

cp .env.example .env
# Edit .env — set ADMIN_API_KEY and at least one provider key (e.g. OPENAI_API_KEY)

docker compose up -d
```

> **Gateway** → `http://localhost:4000`
> **Console** → `http://localhost:4000/console`

### Option 2: Local with Make

```bash
git clone https://github.com/summoned-tech/summoned-ai-gateway.git
cd summoned-ai-gateway
make setup    # installs deps, starts Postgres + Redis, runs migrations, builds console
make dev      # starts the gateway with hot reload
```

### Option 3: Manual Setup

**Prerequisites:** [Bun](https://bun.sh) v1.2+, PostgreSQL, Redis

```bash
git clone https://github.com/summoned-tech/summoned-ai-gateway.git
cd summoned-ai-gateway
bun install
cp .env.example .env   # edit with your keys

# Start Postgres and Redis
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_USER=summoned -e POSTGRES_PASSWORD=summoned \
  -e POSTGRES_DB=summoned_gateway postgres:16-alpine
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Migrate and start
bun run db:generate && bun run db:migrate
bun run dev
```

### Your First Request

**1. Create an API key:**

```bash
curl -X POST http://localhost:4000/v1/keys \
  -H "x-admin-key: YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-first-key", "tenantId": "default"}'
```

**2. Use it:**

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-smnd-YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello from Summoned!"}]
  }'
```

Or skip the CLI entirely — open `http://localhost:4000/console`, go to **API Keys**, click **Create Key**, then test it in the **Playground**.

---

## Supported Providers

| Provider | Model Format | Example |
|---|---|---|
| **OpenAI** | `openai/<model>` | `openai/gpt-4o` |
| **Anthropic** | `anthropic/<model>` | `anthropic/claude-sonnet-4-20250514` |
| **Google Gemini** | `google/<model>` | `google/gemini-2.0-flash` |
| **Groq** | `groq/<model>` | `groq/llama-3.3-70b-versatile` |
| **Azure OpenAI** | `azure/<deployment>` | `azure/gpt-4o` |
| **AWS Bedrock** | `bedrock/<model>` | `bedrock/anthropic.claude-3-haiku-20240307-v1:0` |
| **Ollama** | `ollama/<model>` | `ollama/llama3.2` |
| **Sarvam AI** | `sarvam/<model>` | `sarvam/sarvam-2b-v0.5` |
| **Yotta Labs** | `yotta/<model>` | `yotta/yotta-mini` |

> The gateway is a **pure proxy**. Any model string the upstream provider accepts will work. When a provider launches a new model, it works through the gateway immediately — zero config changes needed.

---

## How to Use

### Use with the OpenAI SDK (zero new dependencies)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000/v1",
    api_key="sk-smnd-...",
)

# Same code you already have — just change the model string
response = client.chat.completions.create(
    model="anthropic/claude-sonnet-4-20250514",   # any provider/model
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

Works with any OpenAI-compatible library — LangChain, LlamaIndex, CrewAI, Autogen, Vercel AI SDK, etc.

### Use with the Summoned SDK (gateway-native features)

```bash
npm install @summoned/ai     # TypeScript
pip install summoned-ai      # Python
```

```typescript
import { Summoned } from "@summoned/ai"

const client = new Summoned({ apiKey: "sk-smnd-..." })

const res = await client.chat.completions.create({
  model: "openai/gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
  config: {
    retry: { attempts: 3, backoff: "exponential" },
    fallback: ["anthropic/claude-sonnet-4-20250514", "groq/llama-3.3-70b-versatile"],
    cache: true,
    guardrails: {
      input: [{ type: "pii", deny: true }],
    },
  },
})

console.log(res.choices[0].message.content)
console.log(client.lastResponseHeaders)
// { provider: "openai", latencyMs: "320", costUsd: "0.000045", cache: "MISS" }
```

### Use OpenAI SDK + Gateway Features via `createHeaders`

```python
from openai import OpenAI
from summoned_ai import create_headers

client = OpenAI(
    base_url="http://localhost:4000/v1",
    api_key="sk-smnd-...",
    default_headers=create_headers(
        config={"cache": True, "fallback": ["groq/llama-3.3-70b-versatile"]}
    ),
)
```

---

## Console

The gateway ships with a **built-in web console** — no extra services, no separate setup. It's served directly from the gateway.

```
http://localhost:4000/console
```

| Feature | Description |
|---|---|
| **Live Logs** | Real-time request stream via WebSocket. Search, filter by status/provider, click to expand full details. |
| **Dashboard** | Request counts, success rate, latency percentiles (p50/p95/p99), top models, cost tracking. |
| **API Keys** | Create, list, and revoke tenant API keys — right from the browser. |
| **Virtual Keys** | Store encrypted provider credentials (AES-256-GCM). Your users never see raw API keys. |
| **Providers** | Health status and circuit breaker state for every registered provider. |
| **Playground** | Send test messages to any model. See provider, latency, cost, and cache status in real-time. |

The console auto-authenticates when served from the gateway — no login required.

---

## Features

### Reliability

| Feature | How it works |
|---|---|
| **Automatic Retries** | Retry failed requests with exponential or linear backoff. |
| **Fallback Models** | Specify alternate `provider/model` slugs to try on failure. |
| **Circuit Breaker** | Per-provider circuit breaker with configurable thresholds. Prevents cascading failures. |
| **Request Timeouts** | Per-request timeouts with automatic cancellation. |

### Security

| Feature | How it works |
|---|---|
| **API Key Auth** | SHA-256 hashed keys with Redis caching for fast lookups. |
| **Rate Limiting** | Per-key RPM (requests per minute) and TPD (tokens per day) limits. |
| **Virtual Keys** | Store provider API keys encrypted (AES-256-GCM) on the gateway. Users reference a virtual key ID instead of raw credentials. |
| **Input/Output Guardrails** | Block PII (email, phone, SSN, Aadhaar, credit card), regex patterns, blocked words, and length limits — on both inputs and outputs. |

### Performance

| Feature | How it works |
|---|---|
| **Response Caching** | Redis-backed cache with configurable TTL. Identical requests return cached responses instantly. |
| **Cost Tracking** | Per-request cost estimation in USD and INR. Costs included in response headers and logs. |
| **Streaming** | Full SSE streaming support for all providers. |

### Per-Request Config

All features are controlled per-request via the `x-summoned-config` header (base64-encoded JSON) or through the SDK's `config` parameter:

```json
{
  "retry": { "attempts": 3, "backoff": "exponential" },
  "fallback": ["groq/llama-3.3-70b-versatile"],
  "timeout": 30000,
  "cache": true,
  "cacheTtl": 3600,
  "virtualKey": "vk_abc123",
  "guardrails": {
    "input": [{ "type": "pii", "deny": true }],
    "output": [{ "type": "contains", "params": { "operator": "none", "words": ["confidential"] }, "deny": true }]
  },
  "metadata": { "env": "production", "user": "u_123" },
  "traceId": "req-abc-123"
}
```

### Response Headers

Every response includes gateway metadata:

```
X-Summoned-Provider:   openai
X-Summoned-Served-By:  openai/gpt-4o
X-Summoned-Cost-USD:   0.000150
X-Summoned-Latency-Ms: 432
X-Summoned-Cache:      MISS
X-Summoned-Trace-Id:   abc-123
```

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/v1/chat/completions` | POST | OpenAI-compatible chat completion (streaming + tools) |
| `/v1/embeddings` | POST | Text embeddings |
| `/v1/models` | GET | List registered providers |
| `/v1/keys` | POST / GET / DELETE | API key management (admin) |
| `/admin/virtual-keys` | POST / GET / DELETE | Virtual key management (admin) |
| `/admin/logs` | GET | Request logs (buffer or database) |
| `/admin/stats` | GET | Aggregated statistics |
| `/admin/providers` | GET | Provider health + circuit breaker state |
| `/ws/logs` | WebSocket | Real-time log streaming |
| `/health` | GET | Liveness check |
| `/console` | GET | Built-in web console |

---

## SDKs

| SDK | Package | Install |
|---|---|---|
| TypeScript | [`@summoned/ai`](https://github.com/summoned-tech/summoned-sdk-ts) | `npm install @summoned/ai` |
| Python | [`summoned-ai`](https://github.com/summoned-tech/summoned-sdk-python) | `pip install summoned-ai` |

Both SDKs provide: chat completions, embeddings, streaming, admin APIs (keys, virtual keys, logs, stats, providers), `createHeaders()` helper, client-side retries, and debug mode. They're thin HTTP clients — all the intelligence lives on the gateway.

---

## Adding a New Provider

Adding a provider takes **~10 lines of code** and **~5 minutes**:

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

**3.** Register it in `src/index.ts`:

```typescript
if (env.YOURPROVIDER_API_KEY) {
  const { createYourProvider } = await import("@/providers/your-provider")
  registry.register(createYourProvider(env.YOURPROVIDER_API_KEY))
  registered.push("yourprovider")
}
```

**4.** Add pricing to `src/lib/pricing.ts` (optional).

That's it. The gateway is a pure proxy — the upstream provider handles model validation.

---

## Configuration

See [`.env.example`](.env.example) for the complete list with links to each provider's key page.

| Variable | Required | Description |
|---|---|---|
| `ADMIN_API_KEY` | Yes | Master admin key (min 32 chars). Generate: `openssl rand -hex 32` |
| `POSTGRES_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | At least one | OpenAI key |
| `ANTHROPIC_API_KEY` | provider key | Anthropic key |
| `GOOGLE_API_KEY` | needed | Google Gemini key |
| `GROQ_API_KEY` | | Groq key |
| `AZURE_OPENAI_API_KEY` | | Azure OpenAI key + `AZURE_OPENAI_ENDPOINT` |
| `AWS_ACCESS_KEY_ID` | | AWS credentials for Bedrock |
| `OLLAMA_BASE_URL` | | Ollama server URL (no key needed) |
| `SARVAM_API_KEY` | | Sarvam AI key |
| `YOTTA_API_KEY` | | Yotta Labs key |
| `REDIS_URL` | No | Default: `redis://localhost:6379` |
| `GATEWAY_PORT` | No | Default: `4000` |
| `USD_INR_RATE` | No | Default: `85` |

---

## Development

```bash
make setup          # Full zero-to-running setup
make dev            # Gateway with hot reload
make dev-console    # Console dev server with HMR
make console        # Rebuild console SPA
make check-types    # TypeScript type checking
make migrate        # Generate + apply DB migrations
make docker         # Docker Compose up
make create-key     # Quick-create an API key
make help           # Show all commands
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- Architecture overview
- How to add a provider (step-by-step)
- How to add new features
- Code style guide

The easiest way to contribute is to add support for a new LLM provider — it's about 10 lines of code.

## License

[MIT](LICENSE)

---

<p align="center">
  Built by <a href="https://github.com/summoned-tech">Summoned Tech</a>
</p>
