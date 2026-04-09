import { createMiddleware } from "hono/factory"
import { redis } from "@/lib/redis"
import { rateLimitHits } from "@/lib/telemetry"
import type { AuthContext } from "@/middlewares/auth"

/**
 * Sliding window rate limiter — per API key, enforced in Redis.
 * Uses a sorted-set with timestamps as scores to count requests in the last 60s.
 */
export const rateLimitMiddleware = createMiddleware<{ Variables: AuthContext }>(async (c, next) => {
  const apiKeyId = c.get("apiKeyId")
  const tenantId = c.get("tenantId")
  const rpm = c.get("rateLimitRpm")

  if (!apiKeyId) return next()

  const now = Date.now()
  const windowMs = 60_000
  const key = `rl:rpm:${apiKeyId}`

  // Sliding window via sorted set
  const pipe = redis.pipeline()
  pipe.zremrangebyscore(key, 0, now - windowMs)
  pipe.zadd(key, now, `${now}-${Math.random()}`)
  pipe.zcard(key)
  pipe.pexpire(key, windowMs)

  const results = await pipe.exec()
  const count = results?.[2]?.[1] as number ?? 0

  if (count > rpm) {
    rateLimitHits.inc({ tenant_id: tenantId })
    return c.json(
      { error: { code: "RATE_LIMITED", message: `Rate limit exceeded. Max ${rpm} requests/minute.` } },
      429,
      { "Retry-After": "60", "X-RateLimit-Limit": String(rpm), "X-RateLimit-Remaining": "0" },
    )
  }

  c.res.headers.set("X-RateLimit-Limit", String(rpm))
  c.res.headers.set("X-RateLimit-Remaining", String(Math.max(0, rpm - count)))

  await next()
})
