---
name: add-guardrail
description: >
  Add a new guardrail type (input or output validation rule) to the Summoned
  AI Gateway. Trigger when the user wants a new safety check, content filter,
  PII detector, prompt-injection detector, toxicity filter, or any per-request
  validation — e.g. "add a toxicity guardrail", "block prompts with X",
  "filter output for Y", "add a prompt-injection check".
---

# Add Guardrail

Guardrails validate LLM inputs (before provider call) and outputs (after).
They live in `src/lib/guardrails.ts` and are configured per-request via
`config.guardrails`.

## Step 0: Gather info

- **Name** — short identifier (e.g. `toxicity`, `topic`, `jailbreak`)
- **Input, output, or both?**
- **Detection approach** — regex, word list, length check, external API,
  local model?
- **Params** — what knobs does the caller set? (threshold, language, model)
- **Deny default** — fail-closed (deny on match) or fail-open?

## Step 1: Extend the schema

**File:** `src/lib/guardrails.ts`

Add the new type to the enum:

```typescript
export const guardrailSchema = z.object({
  type: z.enum(["contains", "regex", "length", "pii", "<new-type>"]),
  params: z.record(z.string(), z.any()).optional(),
  deny: z.boolean().default(true),
})
```

## Step 2: Implement the check

Add a function that returns `{ deny: boolean; reason?: string }`:

```typescript
function check<NewType>(text: string, params: Record<string, any>): GuardrailResult {
  // ...
  return { deny: matched, reason: matched ? "triggered <new-type>" : undefined }
}
```

Wire into the dispatcher (search for where `contains`, `regex`, `pii` are
dispatched) — follow the exact pattern.

## Step 3: External-service guardrails (if applicable)

If the check calls an external API (e.g. Perspective API, Azure Content
Safety):

- Add the env var in `src/lib/env.ts` with empty default.
- Make the check gracefully no-op when the env var is empty (warn + `deny:false`).
- Add a hard timeout (`AbortSignal.timeout(2000)`) so a slow guardrail API
  can't block requests.
- Never log the user's prompt to the external service's logs by default.

## Step 4: Tests

Extend `tests/guardrails.test.ts`:
- Positive case (should deny)
- Negative case (should pass)
- Params edge cases (empty list, bad regex, etc.)
- If external: mock the fetch and cover timeout + 5xx behavior.

## Step 5: Docs

Update `CLAUDE.md` under the guardrail example in the per-request Config
section. Add one line in the comment block at the top of
`src/lib/guardrails.ts` explaining the new type.

## Step 6: Verify

```bash
bun run check-types
bun test tests/guardrails.test.ts
```

## Rules

- Guardrails run synchronously in the request path. Keep them fast (<50ms)
  or wrap in a timeout.
- Never store the prompt or response to disk from a guardrail.
- Fail-closed by default for security-relevant checks; fail-open with a
  warning for quality checks.
- Don't add a guardrail that duplicates an existing type's behavior — extend
  the existing one's params instead.
