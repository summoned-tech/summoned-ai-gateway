import { Hono } from "hono"
import { eq, and } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import { db, virtualKey } from "@/lib/db"
import { encrypt, timingSafeEqual } from "@/lib/crypto"
import { env } from "@/lib/env"
import { logger } from "@/lib/telemetry"

export const virtualKeysRouter = new Hono()

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

const createSchema = z.object({
  name: z.string().min(1).max(100),
  tenantId: z.string().min(1).max(100),
  providerId: z.string().min(1).max(50),
  apiKey: z.string().min(1),
  providerConfig: z.record(z.string(), z.string()).optional(),
})

// POST /admin/virtual-keys — create a virtual key wrapping a provider credential
virtualKeysRouter.post("/", requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON" } }, 400)

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Validation failed", details: parsed.error.flatten() } }, 400)
  }

  const { name, tenantId, providerId, apiKey: providerApiKey, providerConfig } = parsed.data
  const id = `vk_${nanoid(20)}`
  const encryptedKey = await encrypt(providerApiKey)

  await db.insert(virtualKey).values({
    id,
    tenantId,
    name,
    providerId,
    encryptedKey,
    providerConfig: (providerConfig ?? null) as Record<string, string> | null,
  })

  logger.info({ id, tenantId, providerId, name }, "virtual key created")

  return c.json({
    id,
    name,
    tenantId,
    providerId,
    providerConfig: providerConfig ?? null,
    createdAt: new Date().toISOString(),
  }, 201)
})

// GET /admin/virtual-keys?tenantId=... — list virtual keys (never returns the actual provider key)
virtualKeysRouter.get("/", requireAdmin(), async (c) => {
  const tenantId = c.req.query("tenantId")
  if (!tenantId) return c.json({ error: { code: "BAD_REQUEST", message: "tenantId required" } }, 400)

  const rows = await db
    .select({
      id: virtualKey.id,
      name: virtualKey.name,
      tenantId: virtualKey.tenantId,
      providerId: virtualKey.providerId,
      providerConfig: virtualKey.providerConfig,
      isActive: virtualKey.isActive,
      createdAt: virtualKey.createdAt,
      lastUsedAt: virtualKey.lastUsedAt,
    })
    .from(virtualKey)
    .where(eq(virtualKey.tenantId, tenantId))

  return c.json({ data: rows })
})

// DELETE /admin/virtual-keys/:id — revoke a virtual key
virtualKeysRouter.delete("/:id", requireAdmin(), async (c) => {
  const id = c.req.param("id")
  const rows = await db
    .update(virtualKey)
    .set({ isActive: false })
    .where(eq(virtualKey.id, id))
    .returning({ id: virtualKey.id })

  if (!rows.length) return c.json({ error: { code: "NOT_FOUND", message: "Virtual key not found" } }, 404)

  logger.info({ id }, "virtual key revoked")
  return c.json({ id, revoked: true })
})
