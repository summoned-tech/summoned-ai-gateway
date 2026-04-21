import { initTracing, shutdownTracing, logger } from "@/lib/telemetry"
import { timingSafeEqual } from "@/lib/crypto"

initTracing()

import { Hono } from "hono"
import { cors } from "hono/cors"

import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { env } from "@/lib/env"
import { getServeStatic } from "@/runtime/static"
import { startServer } from "@/runtime/server"

// Make `./public` resolve correctly regardless of where the user launched
// the gateway (npx from another dir, Docker WORKDIR, global npm bin, etc.).
// When run from source:      __dirname = .../src   → package root = parent of src
// When run from bundle:      __dirname = .../dist  → package root = parent of dist
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
process.chdir(PACKAGE_ROOT)
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
import { promptsRouter } from "@/routers/prompts"
import { registry } from "@/providers/registry"
import { subscribe, getRecentLogs } from "@/lib/log-buffer"

let ready = false

// Resolve the runtime-correct static-file middleware (hono/bun on Bun,
// @hono/node-server/serve-static on Node). Top-level await is fine in ESM on
// both runtimes (Bun 1.x, Node 18+).
const serveStatic = await getServeStatic()

const app = new Hono()
  .use("*", requestIdMiddleware)
  .use("*", securityHeadersMiddleware)
  .use("*", bodySizeLimitMiddleware)
  .use("*", telemetryMiddleware)
  .onError(errorHandler)

// CORS — permissive for the public API (customers call /v1 from any origin)
// and strictly SAME-ORIGIN for admin surfaces. Not applying CORS on
// /console/api, /admin, /ws/logs means browsers block cross-origin reads,
// which kills the CSRF attack surface for the admin API.
app.use("/v1/*", cors())
app.use("/health", cors())
app.use("/health/*", cors())

// Console SPA — served from /console. `./public` resolves against the
// package root (we chdir'd there above) so it works uniformly on both
// runtimes and regardless of where the user launched the gateway.
app.use("/console/assets/*", serveStatic({ root: "./public" }))
app.use("/console/index.html", serveStatic({ root: "./public" }))
app.get("/console", (c: any) => c.redirect("/console/"))
app.get("/console/", serveStatic({ path: "./public/console/index.html" }))

// Console API — same surface as /admin, protected by the same ADMIN_API_KEY.
// The SPA reads the key from localStorage and sends it as x-admin-key on every
// call. There's no implicit "authenticated because you reached /console" —
// that was a wide-open admin panel when the gateway is exposed publicly.
const consoleApi = new Hono()
consoleApi.use("*", adminRateLimitMiddleware)
consoleApi.route("/", adminRouter)
consoleApi.route("/virtual-keys", virtualKeysRouter)
consoleApi.route("/prompts", promptsRouter)
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
app.route("/admin/prompts", promptsRouter)

// WebSocket `/ws/logs` is wired through the runtime adapter at boot
// (see `startServer` call below) — not as a Hono GET handler here,
// because the upgrade mechanism differs between Bun and Node.

export type AppType = typeof app

// ---------------------------------------------------------------------------
// WebSocket clients — runtime-agnostic. startServer() calls onWsOpen/Close
// callbacks below, which keep this set in sync.
// ---------------------------------------------------------------------------

type WsLike = { send(data: string): void }
const wsClients = new Set<WsLike>()

// ---------------------------------------------------------------------------
// Provider registration — enable providers based on available env vars
// ---------------------------------------------------------------------------

async function registerProviders() {
  const registered: string[] = []

  // AWS Bedrock — register when any auth path is available
  // (explicit keys, or IAM role / instance profile via default cred chain)
  if (env.AWS_BEDROCK_API_KEY || env.AWS_ACCESS_KEY_ID || env.AWS_USE_INSTANCE_PROFILE) {
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

  // OpenRouter — meta-provider aggregator
  if (env.OPENROUTER_API_KEY) {
    const { createOpenRouterProvider } = await import("@/providers/openrouter")
    registry.register(createOpenRouterProvider(env.OPENROUTER_API_KEY))
    registered.push("openrouter")
  }

  // HuggingFace
  if (env.HUGGINGFACE_API_KEY) {
    const { createHuggingFaceProvider } = await import("@/providers/huggingface")
    registry.register(createHuggingFaceProvider(env.HUGGINGFACE_API_KEY))
    registered.push("huggingface")
  }

  // DeepInfra
  if (env.DEEPINFRA_API_KEY) {
    const { createDeepInfraProvider } = await import("@/providers/deepinfra")
    registry.register(createDeepInfraProvider(env.DEEPINFRA_API_KEY))
    registered.push("deepinfra")
  }

  // Hyperbolic
  if (env.HYPERBOLIC_API_KEY) {
    const { createHyperbolicProvider } = await import("@/providers/hyperbolic")
    registry.register(createHyperbolicProvider(env.HYPERBOLIC_API_KEY))
    registered.push("hyperbolic")
  }

  // SambaNova
  if (env.SAMBANOVA_API_KEY) {
    const { createSambaNovaProvider } = await import("@/providers/sambanova")
    registry.register(createSambaNovaProvider(env.SAMBANOVA_API_KEY))
    registered.push("sambanova")
  }

  // Novita
  if (env.NOVITA_API_KEY) {
    const { createNovitaProvider } = await import("@/providers/novita")
    registry.register(createNovitaProvider(env.NOVITA_API_KEY))
    registered.push("novita")
  }

  // Moonshot (Kimi)
  if (env.MOONSHOT_API_KEY) {
    const { createMoonshotProvider } = await import("@/providers/moonshot")
    registry.register(createMoonshotProvider(env.MOONSHOT_API_KEY))
    registered.push("moonshot")
  }

  // Z.AI / Zhipu
  if (env.ZAI_API_KEY) {
    const { createZAIProvider } = await import("@/providers/zai")
    registry.register(createZAIProvider(env.ZAI_API_KEY))
    registered.push("zai")
  }

  // Nvidia NIM
  if (env.NVIDIA_API_KEY) {
    const { createNvidiaNimProvider } = await import("@/providers/nvidia-nim")
    registry.register(createNvidiaNimProvider(env.NVIDIA_API_KEY))
    registered.push("nvidia")
  }

  // vLLM (self-hosted)
  if (env.VLLM_BASE_URL) {
    const { createVLLMProvider } = await import("@/providers/vllm")
    registry.register(createVLLMProvider(env.VLLM_BASE_URL, env.VLLM_API_KEY))
    registered.push("vllm")
  }

  // Voyage AI (embeddings + rerank)
  if (env.VOYAGE_API_KEY) {
    const { createVoyageProvider } = await import("@/providers/voyage")
    registry.register(createVoyageProvider(env.VOYAGE_API_KEY))
    registered.push("voyage")
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

// Broadcast new log entries to all connected WebSocket clients — runtime-agnostic.
subscribe((entry) => {
  const payload = JSON.stringify({ type: "log", data: entry })
  for (const ws of wsClients) {
    try { ws.send(payload) } catch { wsClients.delete(ws) }
  }
})

// ---------------------------------------------------------------------------
// Startup — uses the runtime adapter (Bun.serve on Bun, @hono/node-server +
// @hono/node-ws on Node). Caller-supplied onWsOpen/Close callbacks wire the
// global wsClients set; authorizeUpgrade gates the /ws/logs admin handshake.
// ---------------------------------------------------------------------------

main()
  .then(() =>
    startServer({
      app,
      port: env.GATEWAY_PORT,
      wsPath: "/ws/logs",
      authorizeUpgrade(req) {
        const url = new URL(req.url)
        const key = url.searchParams.get("key") ?? ""
        return !!key && timingSafeEqual(key, env.ADMIN_API_KEY)
      },
      onWsOpen(ws) {
        wsClients.add(ws)
        const recent = getRecentLogs(100)
        try { ws.send(JSON.stringify({ type: "init", logs: recent })) } catch { /* ignore */ }
        logger.debug({ clients: wsClients.size }, "ws client connected")
      },
      onWsClose(ws) {
        wsClients.delete(ws)
        logger.debug({ clients: wsClients.size }, "ws client disconnected")
      },
    }),
  )
  .then(() => {
    logger.info(
      { port: env.GATEWAY_PORT, console: `http://localhost:${env.GATEWAY_PORT}/console` },
      "http server listening",
    )
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
