---
name: add-cache-backend
description: >
  Add a new cache backend implementation to the Summoned AI Gateway. Trigger
  whenever the user wants to support a new cache store — e.g. "add Memcached
  support", "cache to Cloudflare KV", "use DynamoDB as cache", "swap cache
  for Upstash", "add in-memory fallback". Does NOT trigger for tuning TTL
  or existing Redis cache (that's a config change).
---

# Add Cache Backend

The gateway caches non-streaming completions. Today the store is Redis with
an in-memory fallback (`src/lib/cache.ts` + `src/lib/redis.ts`). Adding a
new backend means implementing the same `get`/`set` shape and wiring it
behind the existing cache interface — not forking the cache logic.

## Step 0: Gather info

- **Backend name** — e.g. `memcached`, `dynamodb`, `cf-kv`
- **Connection config** — URL, credentials, region
- **TTL semantics** — does the backend support per-key TTL natively?
- **Size limits** — max key/value size; we cache full JSON completion
  responses (~1-50KB typical)

## Step 1: Read the contract

```
Read src/lib/cache.ts
Read src/lib/redis.ts
```

Note the three primitives used by `cache.ts`:
- `getCache(key): Promise<unknown | null>`
- `setCache(key, value, ttlSeconds): Promise<void>`
- An enabled flag driven by env

## Step 2: Implement the adapter

**File:** `src/lib/cache-backends/<name>.ts`

```typescript
export interface CacheBackend {
  name: string
  enabled: boolean
  get(key: string): Promise<unknown | null>
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>
}

export function create<Name>Backend(): CacheBackend {
  // read env, construct client, return object
}
```

Reuse `src/lib/telemetry`'s `logger` for warnings on connection failures.

## Step 3: Refactor `cache.ts` to use a backend array

If this is the first second backend, extract the backend selection into a
tiny registry:

```typescript
const backends: CacheBackend[] = [redisBackend, memBackend]  // order = priority
```

`getCache` tries backends in order, `setCache` writes only to the first
enabled backend. Keep backward compatibility — if only Redis env vars are
set, behavior is unchanged.

## Step 4: Env vars

**File:** `src/lib/env.ts`

Add the connection env vars with empty defaults:

```typescript
<NAME>_URL: z.string().default(""),
<NAME>_TOKEN: z.string().default(""),
```

The backend's `enabled` flag = `env.<NAME>_URL !== ""`.

## Step 5: Tests

Add `tests/cache-<name>.test.ts`. Mock the client, assert:
- `get` returns null on miss
- `set` + `get` roundtrip preserves value
- TTL is applied
- Disabled backend is a no-op

## Step 6: Docs

Update `CLAUDE.md` Cache line to list supported backends. Add a row to the
provider-style table if useful.

## Step 7: Verify

```bash
bun run check-types
bun test tests/cache*.test.ts
```

## Rules

- Never require the new backend — existing users keep Redis-or-memory behavior.
- Never store raw prompts outside the JSON response body. The cache key is
  already a SHA-256 hash (see `getCacheKey`). Don't weaken that.
- Timeouts on all network calls (`AbortSignal.timeout(200)` for cache reads;
  a slow cache is worse than no cache).
- Cache failures must NEVER fail the request — always fall through to the
  provider call.
