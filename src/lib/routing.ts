import { redis } from "@/lib/redis"
import { logger } from "@/lib/telemetry"
import { getInputCostPer1M } from "@/lib/pricing"

/**
 * Routing strategies — applied to the model chain before the first attempt.
 *
 * "cost"    — sort by cheapest input cost first; fall through to next on failure.
 * "latency" — sort by lowest recorded average latency first (EMA, updated live).
 * "default" — first model in chain wins; explicit priority order from the caller.
 */

// ---------------------------------------------------------------------------
// Cost routing
// ---------------------------------------------------------------------------

export function sortByCost(modelChain: string[]): string[] {
  return [...modelChain].sort((a, b) => {
    return getInputCostPer1M(a) - getInputCostPer1M(b)
  })
}

// ---------------------------------------------------------------------------
// Latency tracking — exponential moving average (EMA) per provider
// ---------------------------------------------------------------------------

const LATENCY_EMA_ALPHA = 0.2 // weight for new observations
const LATENCY_KEY_TTL_SECONDS = 24 * 60 * 60

function latencyKey(providerId: string) {
  return `latency:avg:${providerId}`
}

/**
 * Record a completed request's latency for a provider.
 * Updates an EMA in Redis: new_avg = 0.8 * old_avg + 0.2 * sample
 */
export async function recordProviderLatency(providerId: string, latencyMs: number): Promise<void> {
  const key = latencyKey(providerId)
  try {
    const current = await redis.get(key)
    const prev = current ? Number(current) : latencyMs
    const ema = (1 - LATENCY_EMA_ALPHA) * prev + LATENCY_EMA_ALPHA * latencyMs
    await redis.setex(key, LATENCY_KEY_TTL_SECONDS, ema.toFixed(0))
  } catch (err) {
    logger.warn({ err, providerId }, "failed to record provider latency")
  }
}

/** Get the average observed latency for a provider (ms). Returns null if no data. */
export async function getProviderAvgLatency(providerId: string): Promise<number | null> {
  try {
    const val = await redis.get(latencyKey(providerId))
    return val ? Number(val) : null
  } catch {
    return null
  }
}

/**
 * Sort model chain by ascending average latency.
 * Providers with no latency data are sorted to the end.
 */
export async function sortByLatency(modelChain: string[]): Promise<string[]> {
  const latencies = await Promise.all(
    modelChain.map(async (alias) => {
      const providerId = alias.includes("/") ? alias.split("/")[0] : alias
      const latency = await getProviderAvgLatency(providerId)
      return { alias, latency: latency ?? Number.MAX_SAFE_INTEGER }
    }),
  )
  return latencies.sort((a, b) => a.latency - b.latency).map((x) => x.alias)
}
