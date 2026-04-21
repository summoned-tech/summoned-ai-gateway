---
name: propose-rfc
description: >
  Draft a community RFC (Request for Comments) for a non-trivial change to
  the Summoned AI Gateway — anything that touches the public contract, core
  architecture, or cross-cutting concerns. Trigger when the user says "I want
  to propose X", "let's RFC this", "design doc for Y", or when a change
  obviously needs broader discussion (breaking header change, new middleware
  ordering, new top-level config field).
---

# Propose RFC

Open-source projects move faster when design decisions are written down
before code. This skill generates a community-facing RFC so contributors
can weigh in before implementation.

## When is an RFC needed?

Required when the change:
- Adds/removes/renames an `X-Summoned-*` response header
- Adds/removes/changes a top-level `config` field
- Changes the `provider/model` slug format
- Adds a new route under `/v1/`, `/admin/`, or `/ws/`
- Alters middleware ordering
- Adds a new runtime dependency
- Breaks backward compatibility with either SDK

Not required for: new providers (just use `add-provider`), pricing updates,
bug fixes, internal refactors.

## Step 0: Gather info

- **Title** — short, imperative (e.g. "Unify cache backends behind a
  registry")
- **Problem** — what is broken or missing today?
- **Proposal** — one paragraph
- **Alternatives considered**
- **Affected surfaces** — which files/contracts?
- **Breaking changes** — yes/no + migration path

## Step 1: Find the next RFC number

```bash
ls rfcs/ 2>/dev/null | grep -E '^[0-9]{4}' | sort | tail -1
```

If `rfcs/` doesn't exist, create it with RFC-0001. Otherwise next
zero-padded 4-digit number.

## Step 2: Draft the RFC

**File:** `rfcs/NNNN-<kebab-title>.md`

```markdown
# RFC <NNNN>: <Title>

- **Status:** Draft
- **Author:** <you>
- **Created:** YYYY-MM-DD
- **Target release:** <version or "next minor">

## Summary

One paragraph: what + why.

## Motivation

What is broken today? What can users NOT do? Cite issue numbers
(`#42`) and file paths when referencing current behavior.

## Detailed design

Describe the change at implementation level. Include:
- Before/after code or config snippets
- New/changed contracts (request shape, response header, env var)
- Interaction with existing features (cache, fallback, guardrails, rate-limit)

## SDK impact

- TypeScript SDK: <changes>
- Python SDK:     <changes>
- Both follow via `sdk-syncer` agent after implementation lands.

## Migration

How do existing users adopt the new behavior? Is it opt-in via config,
auto-upgraded, or a breaking change with a deprecation window?

## Alternatives considered

At least two:
- Option A: <describe> — rejected because…
- Option B: <describe> — rejected because…

## Open questions

- <question>
- <question>

## Unresolved security/privacy concerns

…
```

## Step 3: Wire it in

- Add a row to `rfcs/README.md` (create the index file if it doesn't
  exist) with `| NNNN | Title | Status | Author |`.
- Reference the RFC in any tracking issue (`gh issue comment <n> -b ...`).

## Step 4: Announce

Do NOT post to GitHub/Slack/Twitter yourself. Produce a ready-to-paste
announcement snippet (one paragraph + a link) and hand it to the user.

## Rules

- RFCs are prose, not decisions. Don't write "we will do X" — write "this
  proposes X".
- No code changes in the same commit as the RFC. Keep separate.
- Keep under 1000 words unless the change truly warrants more.
- Respect CLAUDE.md design principles — if the RFC violates one (e.g. adds
  a static model catalog), call that out explicitly in the Alternatives
  section.
