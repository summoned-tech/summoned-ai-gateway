#!/usr/bin/env node

/**
 * `@summoned/gateway` CLI entry.
 *
 * Makes `npx @summoned/gateway` launch the gateway on any machine with
 * Node 18+. Picks up configuration from the environment (same .env you'd
 * use for Docker) or command-line flags.
 *
 * Flags:
 *   --port <n>         Override GATEWAY_PORT
 *   --admin-key <k>    Override ADMIN_API_KEY (handy for one-off runs)
 *   --help             Show usage
 *
 * Examples:
 *   ADMIN_API_KEY=... OPENAI_API_KEY=sk-... npx @summoned/gateway
 *   npx @summoned/gateway --port 4200 --admin-key $(openssl rand -hex 32)
 */

/* eslint-disable no-console */

const HELP = `
@summoned/gateway — OpenAI-compatible AI gateway (28 providers)

Usage:
  npx @summoned/gateway [options]

Options:
  --port <n>         Port to listen on (default: env GATEWAY_PORT or 4000)
  --admin-key <k>    Admin key (default: env ADMIN_API_KEY, required)
  --help             Show this help

Environment variables (most common):
  ADMIN_API_KEY           required, 32+ hex chars (openssl rand -hex 32)
  OPENAI_API_KEY          enable OpenAI provider
  ANTHROPIC_API_KEY       enable Anthropic provider
  GOOGLE_API_KEY          enable Google Gemini
  GROQ_API_KEY            enable Groq
  ... and 24 more — see https://github.com/summoned-tech/summoned-ai-gateway

Docs: https://github.com/summoned-tech/summoned-ai-gateway
`

function parseArgs(argv: string[]): void {
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

parseArgs(process.argv.slice(2))

if (!process.env.ADMIN_API_KEY || process.env.ADMIN_API_KEY.length < 32) {
  console.error(
    "[@summoned/gateway] ADMIN_API_KEY is required and must be >= 32 chars.\n" +
    "                   Generate one: openssl rand -hex 32\n" +
    "                   Then:         ADMIN_API_KEY=<key> npx @summoned/gateway\n",
  )
  process.exit(2)
}

// Lazy-import the server so --help / --version return without booting anything.
await import("./index.js")

// Mark this file as a module so top-level await is allowed by tsc.
export {}
