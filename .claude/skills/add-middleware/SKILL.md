---
name: add-middleware
description: >
  Add a new Hono middleware to the Summoned AI Gateway. Trigger whenever the
  user wants to intercept every request — e.g. "add IP allowlist middleware",
  "add a request logger", "add per-tenant quota middleware", "add a
  GeoIP-based routing middleware", "add CORS tweaks".
---

# Add Middleware

Middleware sits between the HTTP request and the router. The existing order
is: CORS → request-id → telemetry → auth → rate-limit. Understand where your
middleware fits before writing it.

## Step 0: Gather info

- **Name** — short kebab-case (e.g. `ip-allowlist`, `tenant-quota`)
- **Scope** — all routes? authed routes only? admin only?
- **Order** — before/after auth? before/after rate-limit?
- **Short-circuit behavior** — does it ever return early (403/429/…)?
- **Side-effects** — DB write, Redis write, header injection?

## Step 1: Create the middleware

**File:** `src/middlewares/<name>.ts`

Mirror the closest existing neighbor:
- Request-transform (inject header/ctx) → `request-id.ts`
- Authentication gate → `auth.ts`
- Rate-limit-style → `rate-limit.ts`
- Observability-only → `telemetry.ts`

Template:

```typescript
import type { MiddlewareHandler } from "hono"
import { logger } from "@/lib/telemetry"

export const <name>Middleware: MiddlewareHandler = async (c, next) => {
  // read what you need from c.req / c.get("apiKey")
  // short-circuit with c.json(..., <status>) if needed
  await next()
  // post-processing (e.g. response headers) goes here
}
```

Prefer `c.set("key", value)` to share state with routers rather than
mutating global maps.

## Step 2: Mount in `src/index.ts`

Insert at the correct position in the chain. Document the position in a
one-line comment above the `app.use()` call.

Scope it correctly:
- Global: `app.use("*", middleware)`
- Authed only: mount AFTER `authMiddleware`
- Specific path: `app.use("/v1/*", middleware)`

## Step 3: Config (optional)

If behavior should be tunable per-request, extend the schema in
`src/lib/config.ts` rather than adding an env var. If truly global, add an
env var in `src/lib/env.ts` with a safe default.

## Step 4: Tests

Add `tests/middleware-<name>.test.ts`:
- Allows a valid request through
- Short-circuits correctly on violation
- Preserves downstream behavior (assert headers/body pass through)

## Step 5: Docs

One-liner in `CLAUDE.md` Entry section explaining the new middleware and
its position in the chain.

## Step 6: Verify

```bash
bun run check-types && bun test
```

Then `curl` a request that should pass and one that should be blocked.

## Rules

- Middleware runs on every request in scope — keep it cheap (<5ms common case).
- Never call an external service synchronously without a timeout.
- Never log the full prompt/response — that's `completions.ts`'s job via the
  audit log.
- Never mutate `c.req` body (Hono buffers it; you'll break downstream reads).
- Always call `await next()` unless you intentionally short-circuit.
