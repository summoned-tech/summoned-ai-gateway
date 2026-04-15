import { createMiddleware } from "hono/factory"
import { redis } from "@/lib/redis"
import { rateLimitHits } from "@/lib/telemetry"
import { getDailyTokensUsed } from "@/lib/budget"
import type { AuthContext } from "@/middlewares/auth"

/**
 * Two-layer rate limiter:
 *   1. Sliding-window RPM — per API key (or per source IP for BYOK/anonymous callers)
 *   2. Daily token budget (TPD) — per API key, enforced before the request is forwarded
 *
 * Both limits live in Redis; neither adds a DB round-trip.
 */
export const rateLimitMiddleware = createMiddleware<{ Variables: AuthContext }>(async (c, next) => {
  const apiKeyId = c.get("apiKeyId")
  const tenantId = c.get("tenantId")
  const rpm = c.get("rateLimitRpm")
  const tpd = c.get("rateLimitTpd") // 0 = unlimited

  if (!apiKeyId) return next()

  const now = Date.now()
  const windowMs = 60_000

  // BYOK / anonymous callers are rate-limited by source IP, not by key ID
  const isPublic = apiKeyId === "byok" || apiKeyId === "anonymous"
  const sourceIp =
    c.req.header("x-real-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  const rpmKey = isPublic ? `rl:ip:${sourceIp}` : `rl:rpm:${apiKeyId}`

  // ---------------------------------------------------------------------------
  // Layer 1 — RPM sliding window
  // ---------------------------------------------------------------------------
  const pipe = redis.pipeline()
  pipe.zremrangebyscore(rpmKey, 0, now - windowMs)
  pipe.zadd(rpmKey, now, `${now}-${Math.random()}`)
  pipe.zcard(rpmKey)
  pipe.pexpire(rpmKey, windowMs)

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

  // ---------------------------------------------------------------------------
  // Layer 2 — Daily token budget (TPD)
  // Skip for BYOK/anonymous (they use their own provider keys) and when tpd=0.
  // ---------------------------------------------------------------------------
  if (!isPublic && tpd > 0) {
    const used = await getDailyTokensUsed(apiKeyId)
    if (used >= tpd) {
      rateLimitHits.inc({ tenant_id: tenantId })
      return c.json(
        {
          error: {
            code: "BUDGET_EXCEEDED",
            message: `Daily token budget of ${tpd.toLocaleString()} tokens exhausted. Resets at midnight UTC.`,
            tokensUsedToday: used,
            budgetTpd: tpd,
          },
        },
        429,
        { "Retry-After": String(secondsUntilMidnightUTC()), "X-Daily-Budget": String(tpd), "X-Daily-Used": String(used) },
      )
    }
    // Expose remaining budget in response headers for client-side awareness
    c.res.headers.set("X-Daily-Budget", String(tpd))
    c.res.headers.set("X-Daily-Used", String(used))
    c.res.headers.set("X-Daily-Remaining", String(Math.max(0, tpd - used)))
  }

  await next()
})

function secondsUntilMidnightUTC(): number {
  const now = new Date()
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000)
}
