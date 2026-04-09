# Summoned AI Gateway

Sovereign AI infrastructure layer for India. OpenAI-compatible gateway that routes LLM requests to AWS Bedrock (ap-south-1) with auth, rate limiting, and audit logging.

## Architecture

- **Entry** (`src/index.ts`) — Hono server on port 4000. Middleware: CORS → request-id → telemetry → auth → rate-limit.
- **Providers** (`src/providers/bedrock.ts`) — AWS Bedrock adapter. Maps friendly model aliases → Bedrock model IDs. Demo mode collapses all tiers to Nova Lite.
- **Routers** (`src/routers/`) — `completions.ts` (POST /v1/chat/completions, GET /v1/models), `keys.ts` (admin CRUD), `health.ts`, `metrics.ts`.
- **Middlewares** (`src/middlewares/`) — `auth.ts` (API key → DB + Redis cache), `rate-limit.ts` (sliding window RPM), `telemetry.ts` (Prometheus + Pino).
- **DB** (`src/db/schema.ts`) — `api_keys` table, `request_logs` (immutable audit trail).
- **Telemetry** (`src/lib/telemetry/`) — OpenTelemetry tracing, Pino structured logging, Prometheus metrics.

## API surface

```
POST /v1/chat/completions   # OpenAI-compatible, streaming + non-streaming
GET  /v1/models             # List available model aliases
POST /v1/keys               # Admin: create API key (x-admin-key required)
GET  /v1/keys?tenantId=...  # Admin: list keys
DELETE /v1/keys/:id         # Admin: revoke key
GET  /health                # Liveness
GET  /health/ready          # Readiness (checks Postgres + Redis)
GET  /metrics               # Prometheus metrics
```

## Model aliases

| Alias | Resolves to (Bedrock) |
|---|---|
| `claude-sonnet-4` | `anthropic.claude-sonnet-4-20250514-v1:0` |
| `nova-pro` | `amazon.nova-pro-v1:0` |
| `nova-lite` | `amazon.nova-lite-v1:0` |
| `nova-micro` | `amazon.nova-micro-v1:0` |

Set `BEDROCK_DEMO_MODE=true` to route all aliases to `nova-lite` for cost saving.

## Conventions

- API keys are hashed with SHA-256; raw key returned only at creation.
- Key cache: Redis with 5-minute TTL to avoid per-request DB reads.
- Rate limiting: sliding window per API key (default 60 RPM).
- All LLM requests are logged to `request_logs` table (async, non-blocking).
- Use `logger` from `@/lib/telemetry` — no `console.log`.
- Imports use `@/` alias.

## Running

```bash
bun run dev          # HTTP server on :4000
bun run db:migrate   # Apply migrations
```

## Adding a new provider

1. Add a new file in `src/providers/`.
2. Extend the model map in `src/providers/bedrock.ts` or add routing logic in `src/routers/completions.ts`.
3. Add provider env vars to `src/lib/env.ts`.
