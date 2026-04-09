import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { SimpleSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base"
import { Resource } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions"
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http"
import { trace, type Span, SpanStatusCode, type Tracer } from "@opentelemetry/api"

const isLocal = process.env.NODE_ENV === "local"
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT

const exporter = otlpEndpoint
  ? new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` })
  : undefined

const resource = new Resource({
  [ATTR_SERVICE_NAME]: "summoned-gateway",
  [ATTR_SERVICE_VERSION]: "0.1.0",
  "deployment.environment": process.env.NODE_ENV ?? "local",
})

const spanProcessors = []
if (exporter) spanProcessors.push(new SimpleSpanProcessor(exporter))
if (isLocal) spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()))

const sdk = new NodeSDK({
  resource,
  spanProcessors,
  instrumentations: [new HttpInstrumentation()],
})

export function initTracing(): void {
  sdk.start()
}

export function shutdownTracing(): Promise<void> {
  return sdk.shutdown()
}

export function getTracer(name = "summoned-gateway"): Tracer {
  return trace.getTracer(name)
}

export function spanError(span: Span, error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error))
  span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
  span.recordException(err)
}

export { SpanStatusCode, type Span }
