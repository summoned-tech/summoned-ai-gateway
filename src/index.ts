import { initTracing, shutdownTracing, logger } from "@/lib/telemetry"

// Tracing must be initialized before any other imports
initTracing()

import { Hono } from "hono"
import { cors } from "hono/cors"

import { env } from "@/lib/env"
import { redis } from "@/lib/redis"
import { getBedrockProvider, refreshModelCache } from "@/providers/bedrock"
import { errorHandler } from "@/lib/error"
import { requestIdMiddleware } from "@/middlewares/request-id"
import { telemetryMiddleware } from "@/middlewares/telemetry"
import { authMiddleware } from "@/middlewares/auth"
import { rateLimitMiddleware } from "@/middlewares/rate-limit"
import { healthRouter } from "@/routers/health"
import { metricsRouter } from "@/routers/metrics"
import { completionsRouter } from "@/routers/completions"
import { keysRouter } from "@/routers/keys"

let ready = false

const app = new Hono()
  .use("*", cors())
  .use("*", requestIdMiddleware)
  .use("*", telemetryMiddleware)
  .onError(errorHandler)

// Public endpoints — no auth required
app.route("/health", healthRouter)
app.route("/metrics", metricsRouter)

// Readiness gate — 503 until initialization completes
app.use("*", async (c: any, next: any) => {
  const path = c.req.path
  if (!ready && path !== "/health" && path !== "/health/ready" && path !== "/metrics") {
    return c.json({ error: { code: "SERVICE_UNAVAILABLE", message: "Gateway is starting up" } }, 503)
  }
  return next()
})

// Protected endpoints — require valid API key + rate limit
const v1 = new Hono()
  .use("*", authMiddleware)
  .use("*", rateLimitMiddleware)
  .route("/", completionsRouter)
  .route("/keys", keysRouter)

app.route("/v1", v1)

export type AppType = typeof app

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main() {
  await redis.connect()
  await getBedrockProvider()
  try {
    await refreshModelCache()
  } catch (err) {
    if (env.BEDROCK_DEMO_MODE) {
      logger.warn({ err }, "model list fetch failed — continuing in demo mode without model list")
    } else {
      throw err
    }
  }
  ready = true

  logger.info({
    port: env.GATEWAY_PORT,
    nodeEnv: env.NODE_ENV,
    awsRegion: env.AWS_REGION,
    demoMode: env.BEDROCK_DEMO_MODE,
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

export default {
  port: env.GATEWAY_PORT,
  fetch: app.fetch,
}
