import { initTracing, shutdownTracing, logger } from "@/lib/telemetry"

initTracing()

import { Hono } from "hono"
import { cors } from "hono/cors"
import { serveStatic } from "hono/bun"

import { env } from "@/lib/env"
import { redis } from "@/lib/redis"
import { errorHandler } from "@/lib/error"
import { requestIdMiddleware } from "@/middlewares/request-id"
import { telemetryMiddleware } from "@/middlewares/telemetry"
import { authMiddleware } from "@/middlewares/auth"
import { rateLimitMiddleware } from "@/middlewares/rate-limit"
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

// Admin endpoints (separate auth via x-admin-key)
app.route("/admin", adminRouter)
app.route("/admin/virtual-keys", virtualKeysRouter)

// WebSocket endpoint for real-time log streaming
app.get("/ws/logs", (c: any) => {
  const upgrade = c.req.header("upgrade")
  if (upgrade?.toLowerCase() !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426)
  }

  // Bun-native WebSocket upgrade
  const server = (c.env as any)?.server ?? (globalThis as any).server
  if (server?.upgrade) {
    const success = server.upgrade(c.req.raw)
    if (success) return undefined
  }

  return c.json({ error: "WebSocket upgrade failed" }, 500)
})

export type AppType = typeof app

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

  return registered
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main() {
  await redis.connect()

  const providers = await registerProviders()

  if (providers.length === 0) {
    logger.warn("no providers configured — set at least one provider API key in env")
  }

  ready = true

  logger.info({
    port: env.GATEWAY_PORT,
    nodeEnv: env.NODE_ENV,
    providers,
    providerCount: providers.length,
    console: `http://localhost:${env.GATEWAY_PORT}/console`,
  }, "summoned-gateway ready")
}

main().catch((err) => {
  logger.fatal({ err }, "gateway failed to start")
  process.exit(1)
})

process.on("SIGTERM", async () => {
  logger.info("shutting down gateway")
  await shutdownTracing()
  await redis.quit()
  process.exit(0)
})

// ---------------------------------------------------------------------------
// WebSocket handler for real-time log streaming (Bun native)
// ---------------------------------------------------------------------------

const wsClients = new Set<any>()

export default {
  port: env.GATEWAY_PORT,
  fetch: app.fetch,
  websocket: {
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
  },
}

// Broadcast new log entries to all connected WebSocket clients
subscribe((entry) => {
  const payload = JSON.stringify({ type: "log", data: entry })
  for (const ws of wsClients) {
    try { ws.send(payload) } catch { wsClients.delete(ws) }
  }
})
