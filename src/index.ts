import { initTracing, shutdownTracing, logger } from "@/lib/telemetry"
import { timingSafeEqual } from "@/lib/crypto"

initTracing()

import { Hono } from "hono"
import { cors } from "hono/cors"
import { serveStatic } from "hono/bun"

import { env } from "@/lib/env"
import { redis, isRedisEnabled } from "@/lib/redis"
import { errorHandler } from "@/lib/error"
import { requestIdMiddleware } from "@/middlewares/request-id"
import { telemetryMiddleware } from "@/middlewares/telemetry"
import { authMiddleware } from "@/middlewares/auth"
import { rateLimitMiddleware } from "@/middlewares/rate-limit"
import {
  securityHeadersMiddleware,
  bodySizeLimitMiddleware,
  metricsAuthMiddleware,
  adminRateLimitMiddleware,
} from "@/middlewares/security"
import { healthRouter } from "@/routers/health"
import { metricsRouter } from "@/routers/metrics"
import { completionsRouter } from "@/routers/completions"
import { embeddingsRouter } from "@/routers/embeddings"
import { keysRouter } from "@/routers/keys"
import { adminRouter } from "@/routers/admin"
import { virtualKeysRouter } from "@/routers/virtual-keys"
import { registry } from "@/providers/registry"
import { subscribe, getRecentLogs } from "@/lib/log-buffer"

let ready = false

const app = new Hono()
  .use("*", cors())
  .use("*", requestIdMiddleware)
  .use("*", securityHeadersMiddleware)
  .use("*", bodySizeLimitMiddleware)
  .use("*", telemetryMiddleware)
  .onError(errorHandler)

// Console SPA — served from /console (built from console/ directory)
app.use("/console/assets/*", serveStatic({ root: "./public" }))
app.use("/console/index.html", serveStatic({ root: "./public" }))
app.get("/console", (c: any) => c.redirect("/console/"))
app.get("/console/", serveStatic({ path: "./public/console/index.html" }))

// Console API — auto-authenticated (the console is served from the gateway itself)
const consoleApi = new Hono()
  .use("*", async (c: any, next: any) => {
    c.set("consoleAuth", true)
    return next()
  })
consoleApi.route("/", adminRouter)
consoleApi.route("/virtual-keys", virtualKeysRouter)
consoleApi.route("/keys", keysRouter)
app.route("/console/api", consoleApi)

// Public endpoints
app.route("/health", healthRouter)

// Metrics — protected: exposes tenant IDs, token volumes, error rates
app.use("/metrics", metricsAuthMiddleware)
app.route("/metrics", metricsRouter)

// Readiness gate
app.use("*", async (c: any, next: any) => {
  const path = c.req.path
  if (!ready && path !== "/health" && path !== "/health/ready" && path !== "/metrics") {
    return c.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Gateway is starting up" } }, 503)
  }
  return next()
})

// Protected endpoints
const v1 = new Hono()
  .use("*", authMiddleware)
  .use("*", rateLimitMiddleware)
  .route("/", completionsRouter)
  .route("/", embeddingsRouter)
  .route("/keys", keysRouter)

app.route("/v1", v1)

// Admin endpoints (separate auth via x-admin-key + brute-force protection)
app.use("/admin/*", adminRateLimitMiddleware)
app.route("/admin", adminRouter)
app.route("/admin/virtual-keys", virtualKeysRouter)

// WebSocket endpoint for real-time log streaming — admin-only
app.get("/ws/logs", (c: any) => {
  const upgrade = c.req.header("upgrade")
  if (upgrade?.toLowerCase() !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426)
  }

  // Require admin key via query param (headers cannot be set by the browser WS API)
  // The console is served from the same origin so it passes the key as ?key=...
  const adminKey = c.req.query("key")
  if (!adminKey || !timingSafeEqual(adminKey, env.ADMIN_API_KEY)) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Valid admin key required" } }, 401)
  }

  // Bun exposes the server as the second arg to fetch(); Hono stores it as c.env.
  // We also keep a globalThis reference set by Bun.serve() in main().
  const server = (globalThis as any).__bunServer ?? (c.env as any)
  if (server?.upgrade) {
    const success = server.upgrade(c.req.raw)
    // When upgrade succeeds Bun takes ownership of the socket and ignores any
    // HTTP response we return — so we return an empty 200 to satisfy Hono.
    if (success) return new Response()
  }

  return c.json({ error: "WebSocket upgrade failed" }, 500)
})

export type AppType = typeof app

// ---------------------------------------------------------------------------
// WebSocket clients — stored module-level so handler and subscriber share state
// ---------------------------------------------------------------------------

const wsClients = new Set<any>()

// ---------------------------------------------------------------------------
// Provider registration — enable providers based on available env vars
// ---------------------------------------------------------------------------

async function registerProviders() {
  const registered: string[] = []

  // AWS Bedrock
  if (env.AWS_BEDROCK_API_KEY || env.AWS_ACCESS_KEY_ID) {
    const { createBedrockProvider, refreshModelCache } = await import("@/providers/bedrock")
    const provider = await createBedrockProvider()
    registry.register(provider)
    try {
      await refreshModelCache()
    } catch (err) {
      if (env.BEDROCK_DEMO_MODE) {
        logger.warn({ err }, "bedrock model list fetch failed — continuing in demo mode")
      } else {
        throw err
      }
    }
    registered.push("bedrock")
  }

  // OpenAI
  if (env.OPENAI_API_KEY) {
    const { createOpenAIProvider } = await import("@/providers/openai")
    registry.register(createOpenAIProvider(env.OPENAI_API_KEY))
    registered.push("openai")
  }

  // Anthropic
  if (env.ANTHROPIC_API_KEY) {
    const { createAnthropicProvider } = await import("@/providers/anthropic")
    registry.register(createAnthropicProvider(env.ANTHROPIC_API_KEY))
    registered.push("anthropic")
  }

  // Google Gemini
  if (env.GOOGLE_API_KEY) {
    const { createGoogleProvider } = await import("@/providers/google")
    registry.register(createGoogleProvider(env.GOOGLE_API_KEY))
    registered.push("google")
  }

  // Groq
  if (env.GROQ_API_KEY) {
    const { createGroqProvider } = await import("@/providers/groq")
    registry.register(createGroqProvider(env.GROQ_API_KEY))
    registered.push("groq")
  }

  // Azure OpenAI
  if (env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_ENDPOINT) {
    const { createAzureOpenAIProvider } = await import("@/providers/azure-openai")
    registry.register(createAzureOpenAIProvider(env.AZURE_OPENAI_API_KEY, env.AZURE_OPENAI_ENDPOINT))
    registered.push("azure")
  }

  // Ollama (local)
  if (env.OLLAMA_BASE_URL) {
    const { createOllamaProvider } = await import("@/providers/ollama")
    registry.register(createOllamaProvider(env.OLLAMA_BASE_URL))
    registered.push("ollama")
  }

  // Sarvam AI
  if (env.SARVAM_API_KEY) {
    const { createSarvamProvider } = await import("@/providers/sarvam")
    registry.register(createSarvamProvider(env.SARVAM_API_KEY))
    registered.push("sarvam")
  }

  // Yotta Labs
  if (env.YOTTA_API_KEY) {
    const { createYottaProvider } = await import("@/providers/yotta")
    registry.register(createYottaProvider(env.YOTTA_API_KEY))
    registered.push("yotta")
  }

  // Mistral AI
  if (env.MISTRAL_API_KEY) {
    const { createMistralProvider } = await import("@/providers/mistral")
    registry.register(createMistralProvider(env.MISTRAL_API_KEY))
    registered.push("mistral")
  }

  // Together AI
  if (env.TOGETHER_API_KEY) {
    const { createTogetherProvider } = await import("@/providers/together")
    registry.register(createTogetherProvider(env.TOGETHER_API_KEY))
    registered.push("together")
  }

  // DeepSeek
  if (env.DEEPSEEK_API_KEY) {
    const { createDeepSeekProvider } = await import("@/providers/deepseek")
    registry.register(createDeepSeekProvider(env.DEEPSEEK_API_KEY))
    registered.push("deepseek")
  }

  // Fireworks AI
  if (env.FIREWORKS_API_KEY) {
    const { createFireworksProvider } = await import("@/providers/fireworks")
    registry.register(createFireworksProvider(env.FIREWORKS_API_KEY))
    registered.push("fireworks")
  }

  // Cohere
  if (env.COHERE_API_KEY) {
    const { createCohereProvider } = await import("@/providers/cohere")
    registry.register(createCohereProvider(env.COHERE_API_KEY))
    registered.push("cohere")
  }

  // Cerebras
  if (env.CEREBRAS_API_KEY) {
    const { createCerebrasProvider } = await import("@/providers/cerebras")
    registry.register(createCerebrasProvider(env.CEREBRAS_API_KEY))
    registered.push("cerebras")
  }

  // Perplexity
  if (env.PERPLEXITY_API_KEY) {
    const { createPerplexityProvider } = await import("@/providers/perplexity")
    registry.register(createPerplexityProvider(env.PERPLEXITY_API_KEY))
    registered.push("perplexity")
  }

  // xAI / Grok
  if (env.XAI_API_KEY) {
    const { createXAIProvider } = await import("@/providers/xai")
    registry.register(createXAIProvider(env.XAI_API_KEY))
    registered.push("xai")
  }

  // Custom OpenAI-compatible providers via CUSTOM_PROVIDERS env var
  if (env.CUSTOM_PROVIDERS) {
    try {
      const customs: Array<{ id: string; name: string; baseUrl: string; apiKey: string }> = JSON.parse(env.CUSTOM_PROVIDERS)
      const { createOpenAICompatProvider } = await import("@/providers/openai-compat")
      for (const c of customs) {
        if (!c.id || !c.baseUrl || !c.apiKey) continue
        registry.register(createOpenAICompatProvider({ id: c.id, name: c.name ?? c.id, apiKey: c.apiKey, baseURL: c.baseUrl }))
        registered.push(c.id)
      }
    } catch (err) {
      logger.warn({ err }, "failed to parse CUSTOM_PROVIDERS — ensure it is valid JSON")
    }
  }

  return registered
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main() {
  if (isRedisEnabled) {
    await (redis as any).connect()
    logger.info("redis connected")
  } else {
    logger.warn("REDIS_URL not set — running without Redis. Rate limiting, caching, and latency routing use in-memory fallbacks.")
  }

  if (!env.POSTGRES_URL) {
    logger.warn("POSTGRES_URL not set — running in stateless mode. Request logs, managed API keys, and the analytics console are disabled. Use x-provider-key for BYOK or set GATEWAY_REQUIRE_AUTH=false.")
  }

  const providers = await registerProviders()

  if (providers.length === 0) {
    logger.warn("no providers configured — set at least one provider API key in env")
  }

  ready = true

  logger.info({
    nodeEnv: env.NODE_ENV,
    providers,
    providerCount: providers.length,
    requireAuth: env.GATEWAY_REQUIRE_AUTH,
  }, "summoned-gateway ready")
}

// ---------------------------------------------------------------------------
// WebSocket handler for real-time log streaming (Bun native)
// ---------------------------------------------------------------------------

const websocketConfig = {
  open(ws: any) {
    wsClients.add(ws)
    // Send recent logs on connect so the console loads instantly
    const recent = getRecentLogs(100)
    ws.send(JSON.stringify({ type: "init", logs: recent }))
    logger.debug({ clients: wsClients.size }, "ws client connected")
  },
  close(ws: any) {
    wsClients.delete(ws)
    logger.debug({ clients: wsClients.size }, "ws client disconnected")
  },
  message(_ws: any, _msg: any) {
    // No inbound messages expected; ignore
  },
}

// Broadcast new log entries to all connected WebSocket clients
subscribe((entry) => {
  const payload = JSON.stringify({ type: "log", data: entry })
  for (const ws of wsClients) {
    try { ws.send(payload) } catch { wsClients.delete(ws) }
  }
})

// ---------------------------------------------------------------------------
// Startup — use explicit Bun.serve() so we can store the server reference
// in globalThis for the WebSocket upgrade handler.
// ---------------------------------------------------------------------------

main()
  .then(() => {
    const server = Bun.serve({
      port: env.GATEWAY_PORT,
      fetch: app.fetch,
      websocket: websocketConfig,
    })
    // Store for use in the /ws/logs upgrade handler
    ;(globalThis as any).__bunServer = server
    logger.info({ port: env.GATEWAY_PORT, console: `http://localhost:${env.GATEWAY_PORT}/console` }, "http server listening")
  })
  .catch((err) => {
    logger.fatal({ err }, "gateway failed to start")
    process.exit(1)
  })

process.on("SIGTERM", async () => {
  logger.info("shutting down gateway")
  await shutdownTracing()
  if (isRedisEnabled) await (redis as any).quit()
  process.exit(0)
})
