import { createMiddleware } from "hono/factory"
import { httpRequestDuration, logger } from "@/lib/telemetry"

export const telemetryMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now()
  const requestId = c.res.headers.get("x-request-id") ?? "unknown"

  await next()

  const durationMs = Date.now() - start
  const durationSec = durationMs / 1000
  const status = c.res.status
  const method = c.req.method
  const route = c.req.routePath ?? c.req.path

  httpRequestDuration.observe({ method, route, status: String(status) }, durationSec)

  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info"
  logger[level]({ method, path: c.req.path, status, durationMs, requestId }, "request")
})
