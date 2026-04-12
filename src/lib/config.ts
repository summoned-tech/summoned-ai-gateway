import { z } from "zod"
import { guardrailSchema } from "@/lib/guardrails"

/**
 * Summoned Gateway config — passed via x-summoned-config header (base64 JSON)
 * or as a `config` field in the request body.
 *
 * Controls retry, fallback, timeout, caching, guardrails, and routing per-request.
 */
export const configSchema = z.object({
  retry: z.object({
    attempts: z.number().int().min(0).max(5).default(0),
    backoff: z.enum(["exponential", "linear"]).default("exponential"),
    initialDelayMs: z.number().int().min(100).max(10_000).default(500),
  }).optional(),

  timeout: z.number().int().min(1_000).max(300_000).optional(),

  fallback: z.array(z.string()).max(5).optional(),

  routing: z.enum(["default", "cost", "latency"]).optional(),

  cache: z.boolean().optional(),
  cacheTtl: z.number().int().min(60).max(86400).optional(),

  // Provider credential forwarding — override provider key at request time
  virtualKey: z.string().optional(),

  // Metadata for tracing/filtering
  metadata: z.record(z.string(), z.string()).optional(),
  traceId: z.string().optional(),

  // Guardrails — input/output validation
  guardrails: z.object({
    input: z.array(guardrailSchema).optional(),
    output: z.array(guardrailSchema).optional(),
  }).optional(),

  // Load balance — weight for this request (used with multiple keys)
  weight: z.record(z.string(), z.number()).optional(),
}).optional()

export type SummonedConfig = z.infer<typeof configSchema>

/**
 * Parse config from a request.
 * Sources (in priority order):
 *   1. x-summoned-config header (base64 JSON)
 *   2. config field in the request body
 */
export function parseConfig(header?: string, bodyConfig?: unknown): SummonedConfig {
  let raw: unknown = undefined

  if (header) {
    try {
      const decoded = Buffer.from(header, "base64").toString("utf-8")
      raw = JSON.parse(decoded)
    } catch {
      try {
        raw = JSON.parse(header)
      } catch { /* ignore malformed config */ }
    }
  }

  if (!raw && bodyConfig) {
    raw = bodyConfig
  }

  if (!raw) return undefined

  const parsed = configSchema.safeParse(raw)
  if (!parsed.success) return undefined
  return parsed.data
}

/**
 * Compute retry delay based on config.
 */
export function retryDelay(config: NonNullable<SummonedConfig>, attempt: number): number {
  const retry = config.retry
  if (!retry) return 0

  const base = retry.initialDelayMs ?? 500
  if (retry.backoff === "linear") return base * (attempt + 1)
  return base * Math.pow(2, attempt)
}
