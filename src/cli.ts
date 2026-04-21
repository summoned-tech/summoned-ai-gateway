#!/usr/bin/env node

/**
 * `@summoned/gateway` CLI entry.
 *
 * Default action launches the gateway server. With a subcommand, runs a
 * one-shot admin operation against a *running* gateway via its HTTP API.
 *
 * Subcommands:
 *   prompts list [--tenant <id>]
 *   prompts show <slug-or-id> [--tenant <id>]
 *   prompts versions <slug> [--tenant <id>]
 *   prompts create --slug <s> --file <path> [--tenant <id>] [--model <m>] [--description <d>]
 *   prompts delete <id>
 *
 * Flags (server mode):
 *   --port <n>         Override GATEWAY_PORT
 *   --admin-key <k>    Override ADMIN_API_KEY (handy for one-off runs)
 *   --help             Show usage
 *
 * Examples:
 *   ADMIN_API_KEY=... OPENAI_API_KEY=sk-... npx @summoned/gateway
 *   npx @summoned/gateway --port 4200 --admin-key $(openssl rand -hex 32)
 *   npx @summoned/gateway prompts list --tenant default
 *   npx @summoned/gateway prompts create --slug support --file prompt.json
 */

/* eslint-disable no-console */

import { readFileSync } from "node:fs"

const HELP = `
@summoned/gateway — OpenAI-compatible AI gateway (28 providers)

Usage:
  npx @summoned/gateway [options]                 # run the gateway server
  npx @summoned/gateway prompts <subcommand> ...  # talk to a running gateway

Server options:
  --port <n>         Port to listen on (default: env GATEWAY_PORT or 4000)
  --admin-key <k>    Admin key (default: env ADMIN_API_KEY, required)
  --help             Show this help

Prompts subcommands:
  prompts list       [--tenant <id>]
  prompts show       <slug-or-id> [--tenant <id>]
  prompts versions   <slug> [--tenant <id>]
  prompts create     --slug <s> --file <path> [--tenant <id>] [--model <m>] [--description <d>]
  prompts delete     <id>

Prompts env vars:
  SUMMONED_GATEWAY_URL    base URL of a running gateway (default: http://localhost:4000)
  ADMIN_API_KEY           admin key of that gateway (required)

Environment variables (most common, server mode):
  ADMIN_API_KEY           required, 32+ hex chars (openssl rand -hex 32)
  OPENAI_API_KEY          enable OpenAI provider
  ANTHROPIC_API_KEY       enable Anthropic provider
  GOOGLE_API_KEY          enable Google Gemini
  GROQ_API_KEY            enable Groq
  ... and 24 more — see https://github.com/summoned-tech/summoned-ai-gateway

Docs: https://github.com/summoned-tech/summoned-ai-gateway
`

type ArgMap = Record<string, string | true>

function parseFlagsAndPositional(argv: string[]): { flags: ArgMap; positional: string[] } {
  const flags: ArgMap = {}
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const name = a.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith("--")) {
        flags[name] = next
        i++
      } else {
        flags[name] = true
      }
    } else {
      positional.push(a)
    }
  }
  return { flags, positional }
}

// ---------------------------------------------------------------------------
// Prompts subcommand — talks to a running gateway's /admin/prompts API
// ---------------------------------------------------------------------------

interface AdminReqOpts {
  method: string
  path: string
  body?: unknown
}

async function adminRequest<T>(opts: AdminReqOpts): Promise<T> {
  const baseUrl = process.env.SUMMONED_GATEWAY_URL ?? "http://localhost:4000"
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) {
    console.error("ADMIN_API_KEY is required to call the admin API.")
    process.exit(2)
  }

  const res = await fetch(`${baseUrl}${opts.path}`, {
    method: opts.method,
    headers: {
      "content-type": "application/json",
      "x-admin-key": adminKey,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  if (!res.ok) {
    const raw = await res.text().catch(() => "")
    let message = raw
    try { message = JSON.parse(raw)?.error?.message ?? raw } catch { /* keep raw */ }
    console.error(`Request failed (${res.status}): ${message || res.statusText}`)
    process.exit(1)
  }

  return res.json() as Promise<T>
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}

async function runPromptsCommand(argv: string[]): Promise<void> {
  const [sub, ...rest] = argv
  const { flags, positional } = parseFlagsAndPositional(rest)
  const tenant = (flags.tenant as string) ?? "default"

  switch (sub) {
    case "list": {
      const res = await adminRequest<{ data: unknown[] }>({
        method: "GET",
        path: `/admin/prompts?tenantId=${encodeURIComponent(tenant)}`,
      })
      printJson(res.data)
      return
    }

    case "show": {
      const ref = positional[0]
      if (!ref) { console.error("Usage: prompts show <slug-or-id>"); process.exit(2) }
      const path = ref.startsWith("prm_")
        ? `/admin/prompts/${encodeURIComponent(ref)}`
        : `/admin/prompts/by-slug/${encodeURIComponent(ref)}?tenantId=${encodeURIComponent(tenant)}`
      const res = await adminRequest<unknown>({ method: "GET", path })
      printJson(res)
      return
    }

    case "versions": {
      const slug = positional[0]
      if (!slug) { console.error("Usage: prompts versions <slug>"); process.exit(2) }
      const res = await adminRequest<{ data: unknown[] }>({
        method: "GET",
        path: `/admin/prompts/${encodeURIComponent(slug)}/versions?tenantId=${encodeURIComponent(tenant)}`,
      })
      printJson(res.data)
      return
    }

    case "create": {
      const slug = flags.slug as string | undefined
      const file = flags.file as string | undefined
      if (!slug || !file) {
        console.error("Usage: prompts create --slug <s> --file <path> [--tenant <id>] [--model <m>] [--description <d>]")
        process.exit(2)
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(readFileSync(file, "utf-8"))
      } catch (err) {
        console.error(`Could not read/parse ${file}: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
      }
      // Accept two shapes:
      //   1. bare array → messages
      //   2. object { template, variables?, defaultModel?, description? }
      let template: unknown[]
      let variables: Record<string, string> | undefined
      let defaultModel: string | undefined = flags.model as string | undefined
      let description: string | undefined = flags.description as string | undefined
      if (Array.isArray(parsed)) {
        template = parsed
      } else if (parsed && typeof parsed === "object") {
        const o = parsed as Record<string, unknown>
        if (!Array.isArray(o.template)) {
          console.error(`${file}: expected "template" to be an array of messages.`)
          process.exit(2)
        }
        template = o.template as unknown[]
        if (o.variables && typeof o.variables === "object") variables = o.variables as Record<string, string>
        if (!defaultModel && typeof o.defaultModel === "string") defaultModel = o.defaultModel
        if (!description && typeof o.description === "string") description = o.description
      } else {
        console.error(`${file}: expected a JSON array or object.`)
        process.exit(2)
      }

      const res = await adminRequest<unknown>({
        method: "POST",
        path: "/admin/prompts",
        body: {
          slug,
          tenantId: tenant,
          template,
          ...(variables ? { variables } : {}),
          ...(defaultModel ? { defaultModel } : {}),
          ...(description ? { description } : {}),
        },
      })
      printJson(res)
      return
    }

    case "delete": {
      const id = positional[0]
      if (!id) { console.error("Usage: prompts delete <id>"); process.exit(2) }
      const res = await adminRequest<unknown>({
        method: "DELETE",
        path: `/admin/prompts/${encodeURIComponent(id)}`,
      })
      printJson(res)
      return
    }

    default:
      console.error(`Unknown prompts subcommand: ${sub ?? "(none)"}\n\n${HELP}`)
      process.exit(2)
  }
}

// ---------------------------------------------------------------------------
// Server mode — original behaviour
// ---------------------------------------------------------------------------

function parseServerArgs(argv: string[]): void {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--help" || a === "-h") {
      console.log(HELP)
      process.exit(0)
    } else if (a === "--port" && argv[i + 1]) {
      process.env.GATEWAY_PORT = argv[++i]
    } else if (a === "--admin-key" && argv[i + 1]) {
      process.env.ADMIN_API_KEY = argv[++i]
    } else if (a === "--version" || a === "-v") {
      // Injected at build time. Fallback for dev.
      console.log(process.env.npm_package_version ?? "dev")
      process.exit(0)
    }
  }
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2)

if (args[0] === "prompts") {
  await runPromptsCommand(args.slice(1))
} else {
  parseServerArgs(args)

  if (!process.env.ADMIN_API_KEY || process.env.ADMIN_API_KEY.length < 32) {
    console.error(
      "[@summoned/gateway] ADMIN_API_KEY is required and must be >= 32 chars.\n" +
      "                   Generate one: openssl rand -hex 32\n" +
      "                   Then:         ADMIN_API_KEY=<key> npx @summoned/gateway\n",
    )
    process.exit(2)
  }

  // Lazy-import the server so --help / --version / subcommands return without
  // booting anything.
  await import("./index.js")
}

// Mark this file as a module so top-level await is allowed by tsc.
export {}
