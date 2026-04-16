import { createMiddleware } from "hono/factory"
import { eq } from "drizzle-orm"
import { db, apiKey } from "@/lib/db"
import { redis } from "@/lib/redis"
import { logger } from "@/lib/telemetry"
import { env } from "@/lib/env"

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
  const providerKey = c.req.header("x-provider-key")

  // ---------------------------------------------------------------------------
  // BYOK mode — caller supplies their own provider key via x-provider-key header.
  // No summoned API key required. Rate-limited per source IP.
  // ---------------------------------------------------------------------------
  if (providerKey && !authHeader) {
    logger.debug({ path: c.req.path }, "byok request — skipping summoned auth")
    c.set("apiKeyId", "byok")
    c.set("tenantId", "public")
    c.set("rateLimitRpm", env.PUBLIC_RPM_LIMIT)
    c.set("rateLimitTpd", 0)
    return next()
  }

  // ---------------------------------------------------------------------------
  // No-auth mode — operator has disabled authentication entirely.
  // Useful for private self-hosted deployments on a trusted network.
  // ---------------------------------------------------------------------------
  if (!env.GATEWAY_REQUIRE_AUTH && !authHeader) {
    c.set("apiKeyId", "anonymous")
    c.set("tenantId", "public")
    c.set("rateLimitRpm", env.PUBLIC_RPM_LIMIT)
    c.set("rateLimitTpd", 0)
    return next()
  }

  // ---------------------------------------------------------------------------
  // Managed mode — validate summoned API key (sk-smnd-...)
  // ---------------------------------------------------------------------------
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: env.GATEWAY_REQUIRE_AUTH
            ? "Missing Authorization header. Use 'Bearer sk-smnd-...' or pass 'x-provider-key' for BYOK mode."
            : "Missing Authorization header.",
        },
      },
      401,
    )
  }

  // Managed key mode requires Postgres. Without it, only BYOK / no-auth works.
  if (!env.POSTGRES_URL) {
    return c.json({
      error: {
        code: "DB_REQUIRED",
        message: "Managed API keys require POSTGRES_URL. Use x-provider-key header for BYOK mode, or set GATEWAY_REQUIRE_AUTH=false for open access.",
      },
    }, 503)
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
