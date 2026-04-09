import { Registry, Counter, Histogram, Gauge } from "prom-client"

export const metricsRegistry = new Registry()

export const httpRequestDuration = new Histogram({
  name: "gateway_http_request_duration_seconds",
  help: "HTTP request latency at the gateway",
  labelNames: ["method", "route", "status"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
})

export const completionRequestCounter = new Counter({
  name: "gateway_completion_requests_total",
  help: "Total completion requests routed through the gateway",
  labelNames: ["provider", "model", "status"],
  registers: [metricsRegistry],
})

export const completionTokensCounter = new Counter({
  name: "gateway_completion_tokens_total",
  help: "Total tokens processed (input + output) by the gateway",
  labelNames: ["provider", "model", "type"],
  registers: [metricsRegistry],
})

export const completionLatency = new Histogram({
  name: "gateway_completion_duration_seconds",
  help: "LLM completion latency from gateway to provider",
  labelNames: ["provider", "model"],
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [metricsRegistry],
})

export const activeCompletions = new Gauge({
  name: "gateway_active_completions",
  help: "Number of in-flight completion streams",
  registers: [metricsRegistry],
})

export const rateLimitHits = new Counter({
  name: "gateway_rate_limit_hits_total",
  help: "Total requests blocked by rate limiting",
  labelNames: ["tenant_id"],
  registers: [metricsRegistry],
})
