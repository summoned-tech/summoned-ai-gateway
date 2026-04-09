export { initTracing, shutdownTracing, getTracer, spanError, SpanStatusCode, type Span } from "@/lib/telemetry/tracing"
export { logger } from "@/lib/telemetry/logger"
export {
  metricsRegistry,
  httpRequestDuration,
  completionRequestCounter,
  completionTokensCounter,
  completionLatency,
  activeCompletions,
  rateLimitHits,
} from "@/lib/telemetry/metrics"
