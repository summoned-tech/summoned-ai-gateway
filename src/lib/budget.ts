import { redis, isRedisEnabled } from "@/lib/redis"
import { logger } from "@/lib/telemetry"

// In-memory fallback counters keyed by "apiKeyId:YYYY-MM-DD"
const memBudget = new Map<string, number>()

/**
 * Daily token budget tracker.
 *
 * Key pattern: rl:tpd:{apiKeyId}:{YYYY-MM-DD}
 * TTL: 48 hours (so yesterday's counts don't linger forever).
 *
 * Why Redis INCRBY instead of a DB write:
 *   - Atomic — no race condition with concurrent requests
 *   - Sub-millisecond — doesn't add latency to the critical path
 *   - Self-expiring — no cleanup job needed
 */

function todayKey(apiKeyId: string): string {
  const date = new Date().toISOString().slice(0, 10) // "2026-03-29"
  return `rl:tpd:${apiKeyId}:${date}`
}

/** How many tokens this key has consumed today. */
export async function getDailyTokensUsed(apiKeyId: string): Promise<number> {
  if (!isRedisEnabled) return memBudget.get(todayKey(apiKeyId)) ?? 0
  try {
    const val = await redis.get(todayKey(apiKeyId))
    return Number(val ?? 0)
  } catch (err) {
    logger.warn({ err, apiKeyId }, "failed to read daily token usage")
    return 0
  }
}

/**
 * Increment the daily token counter after a successful completion.
 * Runs asynchronously — never awaited on the critical path.
 */
export function incrementDailyTokens(apiKeyId: string, tokens: number): void {
  if (!tokens || apiKeyId === "byok" || apiKeyId === "anonymous") return

  const key = todayKey(apiKeyId)
  if (!isRedisEnabled) {
    memBudget.set(key, (memBudget.get(key) ?? 0) + tokens)
    return
  }

  redis
    .pipeline()
    .incrby(key, tokens)
    .expire(key, 48 * 60 * 60)
    .exec()
    .catch((err: unknown) => logger.warn({ err, apiKeyId }, "failed to increment daily token usage"))
}
