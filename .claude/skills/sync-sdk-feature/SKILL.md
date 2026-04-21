---
name: sync-sdk-feature
description: >
  Add a single new feature or field to BOTH first-party SDKs (TypeScript
  @summoned/ai and Python summoned-ai) in one pass. Trigger when the user
  says "add X to the SDKs", "expose config option Y in both SDKs", "TS SDK
  got feature Z, mirror to Python", "add helper for W in the clients". For a
  full parity audit use the sdk-syncer agent instead.
---

# Sync SDK Feature

The gateway has two first-party SDKs and they must stay in lockstep. This
skill adds one feature to both in a single, coherent change.

## Step 0: Gather info

- **Feature** — concrete: "add `virtualKey` to config", "expose
  `X-Summoned-Cache` in response object", "add `client.models.list()`".
- **Gateway source of truth** — which file in this repo defines the
  canonical shape? (usually `src/lib/config.ts`,
  `src/routers/completions.ts`, or the relevant router).
- **SDK repo locations** — default:
  - TS: `../summoned-sdk-ts/`
  - Py: `../summoned-sdk-python/`

  Verify both exist. If not, stop and ask.

## Step 1: Confirm gateway support

The SDKs MUST NOT expose a feature the gateway doesn't support. Grep this
repo for the feature first:

```bash
grep -rn "<field-name>" src/
```

If the gateway doesn't implement it, stop. Either implement in the gateway
first or recommend `propose-rfc`.

## Step 2: Define the canonical shape

Extract the exact field name, type, and validation from the gateway. Write
it down as a 3-5 line spec before touching the SDKs:

```
field:         virtualKey
type:          string (matches /^vk_[a-z0-9]+$/)
location:      config object on chat.completions.create
required:      no
gateway src:   src/lib/config.ts:42
```

## Step 3: Update TS SDK

- Read the SDK's `src/` to find the config/types file.
- Add the field with matching type + JSDoc (link to the gateway docs
  section).
- Update any `types.ts` / `index.d.ts` exports.
- Add a usage example to the SDK's README if user-facing.
- Bump the patch version in `package.json`.
- Run `bun test` (or the SDK's test command) and `bun run check-types`.

## Step 4: Update Python SDK

- Find the equivalent types file (usually `summoned_ai/types.py` or a
  `TypedDict`/`pydantic` model).
- Mirror the field **snake_case** (`virtual_key`, NOT `virtualKey`). The
  SDK serialises to camelCase at the wire layer — confirm that mapping is
  in place.
- Update type stubs and docstrings.
- Add a usage example.
- Bump the patch version in `pyproject.toml`.
- Run `pytest` and `mypy .` (or the SDK's equivalents).

## Step 5: Cross-check

Write a 5-line parity note:
```
Feature:       <name>
TS symbol:     client.chat.completions.create({ config: { <field>: ... } })
Py symbol:     client.chat.completions.create(config={"<field>": ...})
Wire JSON:     { "config": { "<camelCaseField>": ... } }
Gateway file:  src/lib/config.ts:<line>
```

Ensure the wire JSON is identical from both SDKs.

## Step 6: Don't publish

This skill stops at "tests pass in both repos". Use `publish-sdk` to
release.

## Rules

- Same wire format from both SDKs — always.
- Python fields are snake_case; TS fields are camelCase. The serialiser
  bridges the gap.
- If one SDK can't support the feature (e.g. WebSocket helper in Python
  that needs async runtime differences), document the gap in both SDKs'
  READMEs and stop — don't quietly diverge.
- Never bump the minor/major version without user approval.
