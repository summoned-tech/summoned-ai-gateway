import { logger } from "@/lib/telemetry"

export interface FallbackAttempt {
  modelAlias: string
  resolvedModelId: string
  error: string
  attemptIndex: number
}

export interface FallbackResult<T> {
  result: T
  modelAlias: string
  resolvedModelId: string
  attemptIndex: number
  fallbackAttempts: FallbackAttempt[]
}

/**
 * Try a function against each model in the chain in order.
 * Returns the first successful result along with metadata about which model served it
 * and how many fallbacks were attempted.
 *
 * @param modelChain  Ordered list of model aliases to try. First = primary.
 * @param fn          Async function that receives a model alias and returns a result.
 *                    Should throw on failure so the next fallback is tried.
 */
export async function tryWithFallback<T>(
  modelChain: string[],
  fn: (modelAlias: string, attemptIndex: number) => Promise<T>,
): Promise<FallbackResult<T>> {
  if (modelChain.length === 0) throw new Error("Model chain must have at least one model")

  const fallbackAttempts: FallbackAttempt[] = []

  for (let i = 0; i < modelChain.length; i++) {
    const alias = modelChain[i]
    try {
      const result = await fn(alias, i)
      if (i > 0) {
        logger.warn(
          { primaryModel: modelChain[0], servedBy: alias, attemptIndex: i, fallbackAttempts },
          "request served by fallback model",
        )
      }
      return { result, modelAlias: alias, resolvedModelId: alias, attemptIndex: i, fallbackAttempts }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      const isLast = i === modelChain.length - 1

      logger.warn(
        { model: alias, attemptIndex: i, error, isLast },
        isLast ? "all models in fallback chain exhausted" : "model failed, trying next in chain",
      )

      fallbackAttempts.push({ modelAlias: alias, resolvedModelId: alias, error, attemptIndex: i })

      if (isLast) throw err
    }
  }

  // TypeScript: unreachable but satisfies return type
  throw new Error("Fallback chain exhausted")
}

/**
 * Determine if an error is retryable (worth trying the next model).
 * Non-retryable: auth failures, schema errors — these will fail on every model.
 * Retryable: throttling, service unavailable, model not found, timeout.
 */
export function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()

  // Don't retry on auth or bad request — same error will happen on every model
  if (msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("invalid api key")) return false
  if (msg.includes("invalid request") || msg.includes("context length exceeded")) return false

  // Retry on provider-side failures
  if (msg.includes("throttl") || msg.includes("rate limit") || msg.includes("too many requests")) return true
  if (msg.includes("service unavailable") || msg.includes("503") || msg.includes("502")) return true
  if (msg.includes("timeout") || msg.includes("timed out")) return true
  if (msg.includes("model") && (msg.includes("not found") || msg.includes("not available"))) return true

  // Default: retry (better to try than to give up)
  return true
}
