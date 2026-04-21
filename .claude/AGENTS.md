# Summoned AI Gateway — Claude Agents & Skills

This directory ships repo-local **subagents** and **skills** that help Claude
Code (and any Claude Code-compatible harness) work on the gateway
autonomously. Contributors can invoke them directly; maintainers can chain
them for recurring tasks.

## How to use

- **Skills** are invoked by name: `/gateway-context`, `/add-router`, etc.
  They pull up focused instructions for a common task.
- **Subagents** are spawned via the `Agent` tool
  (`subagent_type: "provider-builder"`, etc.) and run with their own
  context. Great for parallel, scoped work.
- The global skills (`add-provider`, `add-migration`, `gateway-deploy`,
  `publish-sdk`, `setup-cicd`, `prd`, `hld`, `discover`, `verify`) are
  shipped with Claude Code itself — they work alongside the repo-local set
  below.

## Subagents (`.claude/agents/`)

| Agent | Purpose | Typical trigger |
|---|---|---|
| `provider-builder` | End-to-end new provider addition (adapter + env + registry + pricing + tests) | "add <X> provider" |
| `provider-tester` | Live-API verification across providers — streaming, non-streaming, embeddings, cost, fallback | After adding a provider, before a release |
| `gateway-architect` | Reviews diffs/PRs against core design principles (pure proxy, thin wrappers, per-request config) | Before merging community PRs |
| `pricing-researcher` | Researches and updates `src/lib/models/*.ts` from official pricing pages | Scheduled maintenance, rate changes |
| `sdk-syncer` | Parity audit + sync between TS (`@summoned/ai`) and Python (`summoned-ai`) SDKs | When SDKs drift |
| `community-triager` | Classifies inbound issues/PRs, drafts responses, suggests labels (never posts) | Inbox triage |
| `provider-scout` | Ranks candidate new providers by strategic fit + adapter effort | Roadmap planning |

## Skills (`.claude/skills/`)

| Skill | Purpose |
|---|---|
| `gateway-context` | Load deep structural context before non-trivial changes |
| `add-router` | Add a new HTTP route/router (Hono) |
| `add-guardrail` | Add a new input/output guardrail type |
| `add-middleware` | Add new Hono middleware with correct ordering |
| `add-prompt` | Scaffold a versioned prompt template + register with a running gateway |
| `update-pricing` | Targeted price updates in `src/lib/models/*.ts` |
| `add-cache-backend` | Implement a new cache backend behind the existing interface |
| `bench-provider` | Benchmark providers (latency, TTFT, cost) via the running gateway |
| `propose-rfc` | Draft a community RFC for contract/architecture changes |
| `sync-sdk-feature` | Add one feature to both SDKs in lockstep |

## Patterns for autonomous work

**Adding a provider (fully automated):**
```
Agent(subagent_type: "provider-builder", prompt: "Add Fireworks AI: base=https://api.fireworks.ai/inference/v1, env=FIREWORKS_API_KEY")
→ Agent(subagent_type: "provider-tester", prompt: "Test fireworks/<model>")
→ Agent(subagent_type: "gateway-architect", prompt: "Review git diff origin/main...HEAD")
```

**Monthly pricing refresh:**
```
Agent(subagent_type: "pricing-researcher", prompt: "Refresh groq pricing")
Agent(subagent_type: "pricing-researcher", prompt: "Refresh openai pricing")
(run in parallel)
```

**Community PR review:**
```
Agent(subagent_type: "community-triager", prompt: "Triage PR #42")
Agent(subagent_type: "gateway-architect", prompt: "Review PR #42")
```

**New feature rollout:**
```
/propose-rfc
→ implementation (normal loop)
→ /sync-sdk-feature
→ Agent(subagent_type: "provider-tester")
→ /publish-sdk (global skill)
```

## Contributing a new agent/skill

1. Put subagents in `.claude/agents/<name>.md` with YAML frontmatter
   (`name`, `description`, `tools`, `model`).
2. Put skills in `.claude/skills/<name>/SKILL.md` with YAML frontmatter
   (`name`, `description`).
3. Keep descriptions specific — they drive auto-triggering.
4. Add a row to the tables above in this file.
5. Stick to the gateway's design principles (see `CLAUDE.md`).

Agents/skills here are part of the project's open-source contract — they
help every contributor, not just the maintainer.
