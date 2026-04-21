---
name: gateway-context
description: >
  Load deep, structured context about the Summoned AI Gateway before making
  non-trivial changes. Use at the start of a new session when the task
  touches gateway internals (providers, routers, middlewares, lib/) and
  CLAUDE.md alone isn't enough. Also trigger on requests like "orient
  yourself", "give me the lay of the land", "what's in this repo?".
---

# Gateway Context Loader

Primes the working memory with the gateway's architecture so downstream work
respects existing patterns instead of inventing parallel ones.

## When to run

- Starting work on a feature that spans multiple files.
- Onboarding a new contributor session.
- Before a refactor in `src/lib/` or `src/providers/`.
- Before reviewing a non-trivial PR.

Skip for pure docs edits, single-line fixes, or when CLAUDE.md already gives
enough context.

## Load order (minimum set — always read)

1. `CLAUDE.md` — principles + provider table
2. `CONTRIBUTING.md` — contributor workflow
3. `package.json` — scripts + dependencies
4. `src/index.ts` — entry, middleware order, `registerProviders()`
5. `src/lib/env.ts` — env schema
6. `src/lib/config.ts` — per-request config shape
7. `src/providers/base.ts` + `src/providers/openai-compat.ts` +
   `src/providers/registry.ts`
8. `src/lib/models/types.ts` + `src/lib/models/index.ts`

## Load by task area

| Task area | Additional files |
|---|---|
| Adding/editing providers | `src/providers/groq.ts`, `src/providers/anthropic.ts`, `src/providers/bedrock.ts` |
| HTTP surface / routers | `src/routers/completions.ts`, `src/routers/embeddings.ts`, `src/routers/admin.ts` |
| Middleware | `src/middlewares/*.ts` |
| Cache / routing | `src/lib/cache.ts`, `src/lib/redis.ts`, `src/lib/routing.ts`, `src/lib/fallback.ts`, `src/lib/circuit-breaker.ts` |
| Guardrails | `src/lib/guardrails.ts` |
| Auth / keys | `src/routers/keys.ts`, `src/routers/virtual-keys.ts`, `src/lib/crypto.ts`, `src/lib/provider-resolve.ts` |
| DB / migrations | `src/db/schema.ts`, `drizzle/*.sql` (latest 3) |
| Telemetry | `src/lib/telemetry/*` |
| Tests | `tests/setup.ts` + nearest existing `tests/*.test.ts` |

## Quick structure scan

Run these in parallel to enrich context:

```bash
# Inventory
ls src/providers src/routers src/middlewares src/lib tests

# Recent code changes (last 30 commits)
git log --oneline -n 30

# What is registered at startup
grep -n "registerProvider\|registerProviders" src/index.ts

# Env surface
grep -E "_API_KEY|_BASE_URL" src/lib/env.ts
```

## Deliverable

Produce a 10-15 line orientation note — NOT a dump. Include:
- Entry flow (middleware order)
- Provider resolution path (`provider/model` → registry → adapter)
- Where cross-cutting concerns live (cache, fallback, guardrails, rate-limit)
- Which design principles are most at risk for the current task
- The 2-3 files the next step will most likely touch

Then stop. The orientation note feeds the next action — it is not the action.
