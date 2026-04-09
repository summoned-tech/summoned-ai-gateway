import { createMiddleware } from "hono/factory"
import { eq } from "drizzle-orm"
import { db, apiKey } from "@/lib/db"
import { redis } from "@/lib/redis"
import { logger } from "@/lib/telemetry"

export interface AuthContext {
  apiKeyId: string
  tenantId: string
  rateLimitRpm: number
  rateLimitTpd: number
}

// Cache resolved keys in Redis for 5 minutes to avoid DB round-trips on every request
const KEY_CACHE_TTL_SECONDS = 300

async function hashKey(raw: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

export const authMiddleware = createMiddleware<{ Variables: AuthContext }>(async (c, next) => {
  const authHeader = c.req.header("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header" } }, 401)
  }

  const rawKey = authHeader.slice(7)
  const hash = await hashKey(rawKey)

  // Fast path: check Redis cache first
  const cacheKey = `apikey:${hash}`
  const cached = await redis.get(cacheKey)

  let keyRecord: { id: string; tenantId: string; rateLimitRpm: number; rateLimitTpd: number } | null = null

  if (cached) {
    keyRecord = JSON.parse(cached)
  } else {
    // Slow path: query DB
    const rows = await db
      .select({
        id: apiKey.id,
        tenantId: apiKey.tenantId,
        rateLimitRpm: apiKey.rateLimitRpm,
        rateLimitTpd: apiKey.rateLimitTpd,
        isActive: apiKey.isActive,
      })
      .from(apiKey)
      .where(eq(apiKey.keyHash, hash))
      .limit(1)

    if (!rows.length || !rows[0].isActive) {
      logger.warn({ hash: hash.slice(0, 8), path: c.req.path }, "invalid or inactive API key")
      return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } }, 401)
    }

    keyRecord = { id: rows[0].id, tenantId: rows[0].tenantId, rateLimitRpm: rows[0].rateLimitRpm, rateLimitTpd: rows[0].rateLimitTpd }
    await redis.setex(cacheKey, KEY_CACHE_TTL_SECONDS, JSON.stringify(keyRecord))

    // Update last_used_at asynchronously — don't block the request
    db.update(apiKey)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKey.id, keyRecord.id))
      .catch((e) => logger.error({ err: e }, "failed to update last_used_at"))
  }

  c.set("apiKeyId", keyRecord!.id)
  c.set("tenantId", keyRecord!.tenantId)
  c.set("rateLimitRpm", keyRecord!.rateLimitRpm)
  c.set("rateLimitTpd", keyRecord!.rateLimitTpd)

  await next()
})
