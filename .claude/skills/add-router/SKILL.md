---
name: add-router
description: >
  Add a new HTTP route or router to the Summoned AI Gateway (Hono).
  Trigger whenever the user wants a new endpoint, REST resource, admin API,
  webhook receiver, or WebSocket handler — e.g. "add a /v1/rerank endpoint",
  "expose an endpoint for X", "we need an API for Y", "add a webhook for Z".
---

# Add Router

Add a new HTTP surface to the gateway. The gateway uses Hono and registers
routers in `src/index.ts`.

## Step 0: Gather info

Ask if missing:
- **Path** — e.g. `/v1/rerank`, `/admin/exports`
- **Method(s)** — GET/POST/DELETE/…
- **Auth** — public (none), API key (tenant), admin only?
- **Request/response shape** — describe in JSON
- **Streaming?** — SSE, WebSocket, or plain JSON
- **Provider-backed?** — does it proxy to an upstream LLM, or is it gateway-internal?

## Step 1: Create the router

**File:** `src/routers/<name>.ts`

Follow the existing patterns — pick the closest analog:
- Provider-proxy endpoint → mirror `src/routers/embeddings.ts`
- Admin resource CRUD → mirror `src/routers/keys.ts` or `virtual-keys.ts`
- Internal/health → mirror `src/routers/health.ts`

Template:

```typescript
import { Hono } from "hono"
import { z } from "zod"
import { logger } from "@/lib/telemetry"

const <name>Router = new Hono()

const bodySchema = z.object({
  // ...
})

<name>Router.post("/", async (c) => {
  const parsed = bodySchema.safeParse(await c.req.json())
  if (!parsed.success) {
    return c.json({ error: { message: parsed.error.message, type: "invalid_request_error" } }, 400)
  }
  // ...business logic...
  return c.json({ /* ... */ })
})

export { <name>Router }
```

## Step 2: Mount in `src/index.ts`

Mount after the middleware chain, grouped with similar routers. Respect
auth scope (public routes mount BEFORE auth middleware; authed routes AFTER).

```typescript
import { <name>Router } from "@/routers/<name>"
// ...
app.route("/v1/<name>", <name>Router)
```

## Step 3: Response headers

If the endpoint proxies to a provider, set the same `X-Summoned-*` headers
that `completions.ts` sets (trace id, provider, cost). Never invent a new
header prefix — use `X-Summoned-*`.

## Step 4: Tests

Add `tests/routers-<name>.test.ts` with Hono's built-in `app.request()`
helper. Cover: happy path, invalid body, auth rejection.

## Step 5: Docs

Update:
- `CLAUDE.md` — add the route to the **API Surface** block
- `README.md` — if user-facing

## Step 6: Verify

```bash
bun run check-types
bun test
```

Start the server and hit the new endpoint with curl to confirm behavior.

## Rules

- Never bypass auth middleware silently. Admin-only routes must check the
  admin API key.
- Never create a new top-level path without versioning (`/v1/...`, `/admin/...`).
- Never duplicate cost/latency/caching logic — reuse `src/lib/*`.
