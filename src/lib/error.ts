import type { Context, ErrorHandler } from "hono"
import { env } from "@/lib/env"
import { logger } from "@/lib/telemetry"

export const errorHandler: ErrorHandler = (err, c: Context) => {
  const requestId = c.req.header("x-request-id") ?? "unknown"

  logger.error({ err, requestId, path: c.req.path }, "unhandled error")

  const detail = env.NODE_ENV === "local" ? err.message : "Internal server error"
  return c.json({ error: { code: "INTERNAL_ERROR", message: detail, requestId } }, 500)
}
