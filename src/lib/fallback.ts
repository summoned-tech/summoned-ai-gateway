import { logger } from "@/lib/telemetry"
import type { SummonedConfig } from "@/lib/config"
import { retryDelay } from "@/lib/config"

export interface FallbackAttempt {
  modelAlias: string
  resolvedModelId: string
  error: string
  attemptIndex: number
  retryAttempt?: number
}

export interface FallbackResult<T> {
  result: T
  modelAlias: string
  resolvedModelId: string
  attemptIndex: number
  totalRetries: number
  fallbackAttempts: FallbackAttempt[]
}

/**
 * Try a function against each model in the chain in order,
 * with optional per-model retries (exponential backoff).
 */
export async function tryWithFallback<T>(
  modelChain: string[],
  fn: (modelAlias: string, attemptIndex: number) => Promise<T>,
  config?: SummonedConfig,
): Promise<FallbackResult<T>> {
  if (modelChain.length === 0) throw new Error("Model chain must have at least one model")

  const maxRetries = config?.retry?.attempts ?? 0
  const fallbackAttempts: FallbackAttempt[] = []
  let totalRetries = 0

  for (let i = 0; i < modelChain.length; i++) {
    const alias = modelChain[i]

    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        if (retry > 0) {
          const delay = retryDelay(config!, retry - 1)
          logger.info({ model: alias, retry, delay }, "retrying after delay")
          await new Promise((resolve) => setTimeout(resolve, delay))
          totalRetries++
        }

        const result = await fn(alias, i)

        if (i > 0 || retry > 0) {
          logger.warn(
            { primaryModel: modelChain[0], servedBy: alias, attemptIndex: i, retry, fallbackAttempts },
            "request served after retry/fallback",
          )
        }

        return { result, modelAlias: alias, resolvedModelId: alias, attemptIndex: i, totalRetries, fallbackAttempts }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        const isLastModel = i === modelChain.length - 1
        const isLastRetry = retry === maxRetries

        fallbackAttempts.push({ modelAlias: alias, resolvedModelId: alias, error, attemptIndex: i, retryAttempt: retry })

        if (!isRetryableError(err)) {
          logger.warn({ model: alias, error, retryable: false }, "non-retryable error, moving to next model")
          break
        }

        if (isLastRetry) {
          logger.warn(
            { model: alias, attemptIndex: i, error, isLastModel, retries: retry },
            isLastModel ? "all models and retries exhausted" : "model exhausted retries, trying next in chain",
          )
        }

        if (isLastModel && isLastRetry) throw err
      }
    }
  }

  throw new Error("Fallback chain exhausted")
}

/**
 * Determine if an error is retryable (worth trying again or next model).
 */
export function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()

  if (msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("invalid api key")) return false
  if (msg.includes("invalid request") || msg.includes("context length exceeded")) return false

  if (msg.includes("throttl") || msg.includes("rate limit") || msg.includes("too many requests")) return true
  if (msg.includes("service unavailable") || msg.includes("503") || msg.includes("502")) return true
  if (msg.includes("timeout") || msg.includes("timed out")) return true
  if (msg.includes("model") && (msg.includes("not found") || msg.includes("not available"))) return true

  return true
}
