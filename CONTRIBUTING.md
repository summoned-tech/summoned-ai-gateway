# Contributing to Summoned AI Gateway

Thanks for your interest in contributing! This guide will help you get set up quickly.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) v1.2+ (`curl -fsSL https://bun.sh/install | bash`)
- Docker (for Postgres and Redis)
- Git

### Getting Started

```bash
git clone https://github.com/summoned-tech/summoned-ai-gateway.git
cd summoned-ai-gateway
make setup
```

This will:
1. Install dependencies (`bun install`)
2. Create `.env` from `.env.example`
3. Start Postgres and Redis containers
4. Run database migrations

Then edit `.env` to add at least one provider API key (e.g. `OPENAI_API_KEY`) and set your `ADMIN_API_KEY`.

```bash
make dev   # Start the gateway at http://localhost:4000
```

### Useful Commands

```bash
make dev           # Dev server with hot reload
make check-types   # TypeScript type checking
make migrate       # Generate + apply DB migrations
make studio        # Drizzle Studio (DB browser)
make create-key    # Quick-create an API key for testing
make help          # Show all available commands
```

## Project Structure

```
src/
├── index.ts           # Entry point — server setup, provider registration
├── providers/         # LLM provider adapters (one file per provider)
├── routers/           # HTTP route handlers
├── middlewares/        # Auth, rate limiting, telemetry
├── lib/               # Shared utilities (config, cache, guardrails, etc.)
└── db/                # Database schema
```

### Key Design Principles

1. **Pure proxy** — The gateway doesn't maintain a static model catalog. Upstream providers validate models. This means zero maintenance when providers add new models.

2. **Thin provider wrappers** — Each provider adapter is ~10 lines. The `createOpenAICompatProvider` factory handles 90% of providers. Only non-standard providers (Bedrock) need custom code.

3. **Per-request config** — All gateway features (retries, fallbacks, caching, guardrails) are controlled per-request via the `x-summoned-config` header. No global behavior that surprises users.

4. **Vercel AI SDK internally** — We use `ai` (Vercel AI SDK) for the actual LLM calls. This gives us streaming, tool calls, and multi-provider support without writing raw HTTP transforms.

## Adding a New Provider

This is the most common contribution. It takes about 5 minutes:

### 1. Create the provider file

```bash
# src/providers/your-provider.ts
```

If the provider has an OpenAI-compatible API:

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

If the provider has a Vercel AI SDK adapter (check [ai-sdk providers](https://sdk.vercel.ai/providers)):

```typescript
import { createYourSDK } from "@ai-sdk/your-provider"
import type { ProviderAdapter } from "./base"

export function createYourProvider(apiKey: string): ProviderAdapter {
  const provider = createYourSDK({ apiKey })
  return {
    id: "yourprovider",
    name: "Your Provider",
    getModel: (modelId) => provider(modelId),
  }
}
```

### 2. Add environment variable

In `src/lib/env.ts`:

```typescript
YOURPROVIDER_API_KEY: z.string().default(""),
```

### 3. Register on startup

In `src/index.ts` inside `registerProviders()`:

```typescript
if (env.YOURPROVIDER_API_KEY) {
  const { createYourProvider } = await import("@/providers/your-provider")
  registry.register(createYourProvider(env.YOURPROVIDER_API_KEY))
  registered.push("yourprovider")
}
```

### 4. Add pricing (optional)

In `src/lib/pricing.ts`, add entries to the `PRICING` map:

```typescript
"yourprovider:model-name": { inputPer1M: 0.50, outputPer1M: 1.50 },
```

### 5. Update `.env.example`

Add the new env var with a comment linking to the provider's docs.

### 6. Test

```bash
make dev
# Set YOURPROVIDER_API_KEY in .env, then:
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-smnd-..." \
  -H "Content-Type: application/json" \
  -d '{"model": "yourprovider/some-model", "messages": [{"role":"user","content":"Hello"}]}'
```

## Adding a New Feature

### Gateway features (caching, guardrails, etc.)

1. Add config fields to `src/lib/config.ts` (the `configSchema`)
2. Implement the logic in a new file under `src/lib/`
3. Integrate into `src/routers/completions.ts` (the main request flow)
4. Update the `CLAUDE.md` documentation

### Admin endpoints

1. Add the route in `src/routers/admin.ts` or create a new router
2. Mount it in `src/index.ts`
3. Add SDK methods in both TypeScript and Python SDKs

## Code Style

- TypeScript with strict mode
- No semicolons (Bun/Hono convention)
- Prefer `const` over `let`
- Use Zod for all input validation
- Use `@/` path alias for imports (maps to `src/`)

## Commit Messages

Use conventional commits:

```
feat: add Mistral AI provider
fix: handle empty response body in streaming
docs: update provider table in README
```

## Questions?

Open an issue or start a discussion on GitHub. We're friendly!
