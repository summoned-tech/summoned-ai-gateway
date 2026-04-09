import pino from "pino"
import { context, trace } from "@opentelemetry/api"

const isLocal = process.env.NODE_ENV === "local"

const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport: isLocal ? { target: "pino-pretty", options: { colorize: true } } : undefined,
  base: { service: "summoned-gateway" },
  mixin() {
    const span = trace.getActiveSpan()
    if (!span) return {}
    const ctx = span.spanContext()
    return { traceId: ctx.traceId, spanId: ctx.spanId }
  },
})

export const logger = baseLogger
