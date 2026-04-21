---
name: update-pricing
description: >
  Update per-token pricing for one or more providers in src/lib/models/*.ts.
  Trigger when the user says prices changed, a new model is out, cost numbers
  look wrong, or "refresh pricing for X". For a full autonomous pass across
  a provider, spawn the pricing-researcher subagent instead.
---

# Update Pricing

Pricing lives in `src/lib/models/<provider>.ts` as `ModelDefinition[]`. The
gateway reports $0 for unknown models — so out-of-date files quietly
under-report cost.

## Step 0: Gather info

- **Provider** — id matches filename (e.g. `groq` → `src/lib/models/groq.ts`)
- **Changes** — specific model ids + new prices, OR "refresh all" (use the
  pricing-researcher agent for the latter)
- **Source URL** — official pricing page

## Step 1: Read current state

```
Read src/lib/models/<id>.ts
```

Note existing entries. Never blow away the file.

## Step 2: Apply updates

Use `Edit` with a narrow `old_string`/`new_string` per model. Preserve:
- Model order
- `contextWindow`, `capabilities`, `description`
- `deprecated: true` flags

Convert units correctly: a page quoting "$X per 1K" → `X * 1000` in
`inputPricePer1M`. Cached input rates go in a code comment, NOT in the
primary price field.

## Step 3: Add new models

Append to the array with the same field order as existing entries. Every
new model needs `id`, `name`, `inputPricePer1M`, `outputPricePer1M`. Prefer
adding `contextWindow` and `capabilities` if documented.

## Step 4: Retire old models

Do NOT delete — mark `deprecated: true`. Historical request_logs may still
reference the id.

## Step 5: Verify

```bash
bun run check-types
bun test tests/pricing.test.ts
```

Then spot-check by computing cost for a known prompt:
```bash
curl -s http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-smnd-..." \
  -d '{"model":"<provider>/<model>","messages":[{"role":"user","content":"hi"}]}' \
  -D - | grep X-Summoned-Cost-USD
```

## Rules

- Every price must be traceable to a URL. Paste the source URL into the PR
  description (not the code).
- Don't change a price by >20% without explicit source confirmation — that's
  usually a units error.
- Don't touch provider adapters, env, or the registry.
- If the models file doesn't exist (new provider), create it and wire into
  `src/lib/models/index.ts` — but that path really belongs to the
  `add-provider` skill.
