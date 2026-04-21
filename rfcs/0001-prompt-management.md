# RFC 0001: Prompt Management

- **Status:** Accepted
- **Author:** Himvan
- **Created:** 2026-04-20
- **Target release:** 0.2.0

## Summary

Add a narrowly-scoped prompt management capability to the gateway: store
versioned prompt templates in the DB, reference them from requests via
`config.promptId`, and interpolate variables before the provider call. No
editor UI, no eval runner, no A/B traffic splitting — those belong in
separate layers.

## Motivation

Users of LLM gateways routinely need to:
- Version prompts without deploying application code.
- Share the same prompt across TypeScript, Python, and non-SDK services.
- Audit which prompt version was used for any historical request.
- Roll back a prompt change the same way they roll back code.

Today contributors have to embed prompts in code (lose versioning) or build
out-of-band infra (duplicate of our audit log). Every comparable gateway
(Portkey, LiteLLM, Helicone) ships this. Going public without it is a
credibility gap.

## Detailed design

### Data model

New table `prompts` (Postgres only):

```
id               text          primary key (e.g. "prm_abc123")
slug             text          human-readable name, stable across versions
version          integer       monotonic per slug (1, 2, 3, …)
tenant_id        text          scoping
template         jsonb         OpenAI messages[] with `{{var}}` placeholders
variables        jsonb         optional { name: default_value } map
default_model    text          optional "provider/model-id" override
description      text          optional
is_latest        boolean       exactly one per (tenant_id, slug)
is_active        boolean       soft-delete flag
created_at       timestamp
```

Unique index on `(tenant_id, slug, version)`. Partial unique index on
`(tenant_id, slug) where is_latest = true`.

### Resolution

`config.promptId` accepts three forms:
- `"<slug>"` — resolves to the `is_latest` row for the tenant
- `"<slug>@<version>"` — pins a specific version
- `"<row-id>"` — pins by primary key (useful for ephemeral/unnamed prompts)

On each request:
1. Gateway fetches the prompt row (Redis-cached by key).
2. Interpolates `{{varname}}` placeholders using `config.promptVariables`
   (fallback to the template's defaults; missing variables are left as the
   literal `{{name}}` so users can diagnose by eyeballing the output).
3. Prepends the resolved messages to `req.messages`. If the caller also
   supplied `messages`, the rule is: template messages come first, caller
   messages follow — enabling the common pattern "system prompt via
   template, user turn from the caller".
4. If the prompt row has `default_model` and the request did not specify
   `model`, use the prompt's default. Caller-supplied model always wins.

### Request contract

```jsonc
// POST /v1/chat/completions
{
  "model": "openai/gpt-4o",
  "messages": [{ "role": "user", "content": "Summarise this ticket" }],
  "config": {
    "promptId": "customer-support@3",
    "promptVariables": { "tone": "friendly", "max_bullets": "5" }
  }
}
```

If `messages` is omitted entirely and the prompt fully specifies the
conversation, the gateway runs with just the template's messages.

### Admin API

```
POST   /admin/prompts                       create new version (auto-increments)
GET    /admin/prompts?tenantId=...          list latest version per slug
GET    /admin/prompts/:id                   fetch exact row
GET    /admin/prompts/by-slug/:slug?tenantId=... latest for a slug
GET    /admin/prompts/:slug/versions?tenantId=... version history
DELETE /admin/prompts/:id                   soft-delete (sets is_active=false)
```

Auth: `x-admin-key`, same as `/admin/virtual-keys`.

### Audit

Extend `request_logs` with `prompt_id` (text, nullable) and `prompt_version`
(integer, nullable). Populated when `config.promptId` is used. Existing rows
are unaffected.

### Response envelope

Add `summoned.prompt = { id, slug, version }` to the non-streaming response
body when a prompt was applied. No new response header (the `X-Summoned-*`
surface is already busy; the envelope is the right place for per-call
metadata).

### Interpolation rules

- Syntax: `{{name}}` — whitespace-tolerant, alphanumerics + underscore.
- No conditionals, no loops, no includes. Full templating belongs in
  application code, not in the gateway.
- Values are string-only; non-string `promptVariables` entries are
  stringified with `String(v)`.
- Placeholders with no matching variable remain literal — surfaces the bug
  loudly instead of silently shipping empty strings.

## SDK impact

- TypeScript SDK: add `promptId` + `promptVariables` to the `config` type.
- Python SDK: same fields in `SummonedConfig` TypedDict.

Both fields are optional. No breaking changes. The SDKs do nothing special
beyond passing the values through — resolution is entirely server-side.

## Migration

Fully additive:
- New table (no impact on existing DBs that haven't migrated).
- Two new nullable columns on `request_logs`.
- New optional config fields.

Users who don't touch prompts see zero behavior change.

In stateless mode (no `POSTGRES_URL`), the feature is unavailable — the
gateway responds with `400 PROMPT_REQUIRES_DB` when `config.promptId` is
present. Mirrors how `virtualKey` behaves today.

## Alternatives considered

- **Client-side template resolution in the SDKs.** Rejected — breaks the
  "one source of truth for prompt text" property; non-SDK callers (curl,
  Postman, another SDK) lose versioning.
- **External store (e.g. integrate with Langfuse / PromptLayer).** Rejected
  for v1 — forces every deployer to run a second system. Leaves room for an
  opt-in "prompt source" adapter later.
- **In-memory only (Redis).** Rejected — prompts are durable config, not
  ephemeral state; losing them on Redis restart is unacceptable.
- **Full Liquid/Jinja templating.** Rejected — tiny gain, large security
  surface (SSTI). Keep `{{name}}` replacement only.

## Open questions

- Should we cache resolved prompts in Redis, or rely on the Drizzle query
  being fast enough? Decision: cache under `prompt:<tenant>:<slug>:<ver>`
  with 60s TTL. Invalidate on write.
- Should the gateway enforce a max template size? Decision: 256 KB, big
  enough for any reasonable prompt, small enough to bound memory.
- Should we validate that placeholder names are a subset of `variables`?
  Decision: no — the "literal placeholder survives" rule gives a better
  debug signal than an upfront 400.

## Unresolved security / privacy concerns

- Prompt templates can contain sensitive text (compliance language, brand
  voice docs). The `/admin/prompts` surface is admin-gated and the API
  never returns prompts to non-admin callers — the completion endpoint
  uses them internally. No exfiltration path adds.
- `promptVariables` are caller-supplied; they flow into the resolved prompt
  text but not into gateway logs (only `prompt_id` + `prompt_version` are
  logged). Same privacy posture as `req.messages`.
- Log-injection: users who set `promptVariables.x = "... Ignore previous
  instructions ..."` can still steer the model. That's unavoidable — any
  user-variable system has this property. We document it, we don't
  "sanitise".
