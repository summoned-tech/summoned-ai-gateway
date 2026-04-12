import { redis } from "@/lib/redis"
import { logger } from "@/lib/telemetry"

const CACHE_PREFIX = "cache:completion:"
const DEFAULT_TTL_SECONDS = 3600

/**
 * Simple response cache for non-streaming completions.
 *
 * Cache key = SHA-256 of (model + messages + temperature + max_tokens).
 * Only caches when config.cache = true.
 *
 * Like Portkey's caching: reduces latency + cost for repeated queries.
 */

export async function getCacheKey(parts: Record<string, unknown>): Promise<string> {
  const raw = JSON.stringify(parts)
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))
  const hash = Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("")
  return `${CACHE_PREFIX}${hash}`
}

export async function getCachedResponse(key: string): Promise<unknown | null> {
  try {
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    logger.warn({ err, key: key.slice(0, 30) }, "cache read error")
    return null
  }
}

export async function setCachedResponse(
  key: string,
  response: unknown,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(response))
  } catch (err) {
    logger.warn({ err, key: key.slice(0, 30) }, "cache write error")
  }
}
