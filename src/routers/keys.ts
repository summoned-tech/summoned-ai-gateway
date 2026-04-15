import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import { db, apiKey } from "@/lib/db"
import { redis } from "@/lib/redis"
import { env } from "@/lib/env"
import { timingSafeEqual } from "@/lib/crypto"
import { logger } from "@/lib/telemetry"

// ---------------------------------------------------------------------------
// Admin key management — protected by ADMIN_API_KEY header
// Used to provision keys for tenants. Not exposed in the public API surface.
// ---------------------------------------------------------------------------

export const keysRouter = new Hono()

function requireAdmin() {
  return async (c: any, next: any) => {
    if (c.get("consoleAuth")) return next()
    const key = c.req.header("x-admin-key") ?? ""
    if (!timingSafeEqual(key, env.ADMIN_API_KEY)) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid admin key" } }, 401)
    }
    return next()
  }
}

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  tenantId: z.string().min(1).max(100),
  rateLimitRpm: z.number().int().min(1).max(10_000).default(60),
  rateLimitTpd: z.number().int().min(1_000).max(100_000_000).default(1_000_000),
})

async function hashKey(raw: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

// POST /v1/keys — create a new API key
keysRouter.post("/", requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON" } }, 400)

  const parsed = createKeySchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Validation failed", details: parsed.error.flatten() } }, 400)
  }

  const { name, tenantId, rateLimitRpm, rateLimitTpd } = parsed.data

  // Generate: "sk-smnd-" prefix + 48 random chars
  const rawKey = `sk-smnd-${nanoid(48)}`
  const keyHash = await hashKey(rawKey)
  const id = `key_${nanoid(20)}`

  await db.insert(apiKey).values({ id, keyHash, name, tenantId, rateLimitRpm, rateLimitTpd })

  logger.info({ id, tenantId, name }, "API key created")

  // Return the raw key once — it cannot be recovered after this response
  return c.json({ id, key: rawKey, name, tenantId, rateLimitRpm, rateLimitTpd, createdAt: new Date().toISOString() }, 201)
})

// GET /v1/keys — list keys for a tenant (no raw key values returned)
keysRouter.get("/", requireAdmin(), async (c) => {
  const tenantId = c.req.query("tenantId")
  if (!tenantId) return c.json({ error: { code: "BAD_REQUEST", message: "tenantId query param required" } }, 400)

  const rows = await db
    .select({ id: apiKey.id, name: apiKey.name, tenantId: apiKey.tenantId, rateLimitRpm: apiKey.rateLimitRpm, rateLimitTpd: apiKey.rateLimitTpd, isActive: apiKey.isActive, createdAt: apiKey.createdAt, lastUsedAt: apiKey.lastUsedAt })
    .from(apiKey)
    .where(eq(apiKey.tenantId, tenantId))

  return c.json({ keys: rows })
})

// DELETE /v1/keys/:id — revoke a key
keysRouter.delete("/:id", requireAdmin(), async (c) => {
  const id = c.req.param("id")

  const rows = await db
    .update(apiKey)
    .set({ isActive: false })
    .where(eq(apiKey.id, id))
    .returning({ id: apiKey.id, keyHash: apiKey.keyHash })

  if (!rows.length) return c.json({ error: { code: "NOT_FOUND", message: "Key not found" } }, 404)

  // Bust Redis cache
  const hash = rows[0].keyHash
  await redis.del(`apikey:${hash}`)

  logger.info({ id }, "API key revoked")
  return c.json({ id, revoked: true })
})
