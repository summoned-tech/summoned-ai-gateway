---
name: add-prompt
description: >
  Scaffold a new versioned prompt template for the Summoned AI Gateway and
  upload it to a running gateway's /admin/prompts API. Trigger whenever the
  user wants to add/create/store a prompt, save a system prompt, version a
  template, or "make this prompt reusable" — e.g. "add a customer-support
  prompt", "save this as a prompt template", "version my prompt for Claude".
---

# Add Prompt

Creates a well-formed prompt template and registers it with a running gateway.
Uses the built-in `prompts` subcommand of the gateway CLI — no extra tooling
required.

## Step 0: Gather info

Ask the user (if missing):
- **Slug** — stable identifier (kebab-case, alphanumerics + `-`/`_`).
  e.g. `customer-support`, `code-reviewer-v2`
- **Tenant** — default `default` if they have one tenant.
- **Purpose** — one sentence describing what the prompt does.
- **Messages** — the actual system/user/assistant turns. If the user pastes
  a loose prompt string, propose a structured version with a `system` message
  and a `user` message using `{{variable}}` placeholders.
- **Variables** — names + default values (optional).
- **Default model** — `provider/model-id` (optional).

## Step 1: Author the template file

Write `prompts/<slug>.json` (create the directory if it doesn't exist). Shape:

```json
{
  "template": [
    { "role": "system", "content": "You are a {{tone}} {{role}} assistant." },
    { "role": "user",   "content": "{{user_input}}" }
  ],
  "variables": {
    "tone": "friendly",
    "role": "support"
  },
  "defaultModel": "openai/gpt-4o",
  "description": "Customer support first-response generator"
}
```

Rules the scaffolding must follow:
- Use `{{variable}}` (not `${}`, `%()s`, or Jinja).
- Missing variables survive literally in output — that's the intended debug
  signal. Don't add fallback logic.
- Keep one concern per prompt. If the user is mixing "summarise" + "translate"
  + "tone-shift" in one template, suggest splitting.
- Template must contain at least one message.

## Step 2: Sanity-check

Before upload:
- Every `{{name}}` in the template appears in `variables` OR is expected
  from caller input — list the ones the caller must supply in the summary.
- No secrets, API keys, PII baked into the template.
- Serialised JSON under 256 KB (gateway enforces this).

## Step 3: Upload (optional — only if the user wants to register now)

If the user has a running gateway:

```bash
# Required env
export ADMIN_API_KEY="..."
export SUMMONED_GATEWAY_URL="http://localhost:4000"  # or wherever

# Create v1 (or auto-increment if slug exists)
npx @summoned/gateway prompts create \
  --slug <slug> \
  --file prompts/<slug>.json \
  --tenant <tenant>
```

If the gateway is not running, print the exact command the user can run later
and do not attempt the upload.

## Step 4: Document usage

Print a copy-paste block showing how to call the prompt from a completion
request:

```bash
curl $SUMMONED_GATEWAY_URL/v1/chat/completions \
  -H "Authorization: Bearer sk-smnd-..." \
  -d '{
    "model": "<model-or-empty>",
    "messages": [],
    "config": {
      "promptId": "<slug>",
      "promptVariables": { "user_input": "..." }
    }
  }'
```

If the prompt has a `defaultModel` and the caller is happy to use it, the
`model` field in the request body may be empty.

## Rules

- Never upload without the user's explicit confirmation once the scaffold
  is ready. `prompts create` is reversible (soft-delete), but the user may
  want to review the file first.
- Never embed the admin API key in the scaffolded file or in tracked docs.
- Never overwrite an existing `prompts/<slug>.json` without asking — the
  file is the user's source of truth for that slug.
- Use `SUMMONED_GATEWAY_URL` + `ADMIN_API_KEY` from the environment; do not
  invent URLs.

## Output

1. The path of the scaffolded file.
2. The exact `npx @summoned/gateway prompts create …` command.
3. The curl example for using the prompt from the `/v1/chat/completions`
   endpoint.
4. The list of variables the caller is expected to supply (i.e. placeholders
   not covered by defaults).
