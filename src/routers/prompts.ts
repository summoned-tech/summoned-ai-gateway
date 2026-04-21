import { Hono } from "hono"
import { and, desc, eq, max } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import { db, prompt } from "@/lib/db"
import { timingSafeEqual } from "@/lib/crypto"
import { env } from "@/lib/env"
import { logger } from "@/lib/telemetry"
import { invalidatePromptCache, templateByteSize, PROMPT_MAX_TEMPLATE_BYTES } from "@/lib/prompts"

export const promptsRouter = new Hono()

promptsRouter.use("*", async (c: any, next: any) => {
  if (!env.POSTGRES_URL) {
    return c.json({
      error: {
        code: "DB_REQUIRED",
        message: "Prompt management requires POSTGRES_URL. Running in stateless mode.",
      },
    }, 503)
  }
  return next()
})

function requireAdmin() {
  return async (c: any, next: any) => {
    const key = c.req.header("x-admin-key") ?? ""
    if (!timingSafeEqual(key, env.ADMIN_API_KEY)) {
      return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid admin key" } }, 401)
    }
    return next()
  }
}

const messageTemplateSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.union([z.string(), z.array(z.any())]),
}).passthrough()

const createSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "slug must be alphanumeric, _, or -"),
  tenantId: z.string().min(1).max(100),
  template: z.array(messageTemplateSchema).min(1),
  variables: z.record(z.string(), z.string()).optional(),
  defaultModel: z.string().optional(),
  description: z.string().max(500).optional(),
})

// POST /admin/prompts — create a new prompt version.
// If a prompt with the same (tenantId, slug) exists, increments version and
// shifts `is_latest` to the new row. Otherwise creates v1.
promptsRouter.post("/", requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON" } }, 400)

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Validation failed", details: parsed.error.flatten() } }, 400)
  }

  const { slug, tenantId, template, variables, defaultModel, description } = parsed.data

  if (templateByteSize(template) > PROMPT_MAX_TEMPLATE_BYTES) {
    return c.json({
      error: {
        code: "TEMPLATE_TOO_LARGE",
        message: `Template exceeds ${PROMPT_MAX_TEMPLATE_BYTES} bytes`,
      },
    }, 400)
  }

  // Find the current max version for this (tenant, slug)
  const [{ currentMax } = { currentMax: null }] = await db
    .select({ currentMax: max(prompt.version) })
    .from(prompt)
    .where(and(eq(prompt.tenantId, tenantId), eq(prompt.slug, slug)))

  const nextVersion = (currentMax ?? 0) + 1
  const id = `prm_${nanoid(20)}`

  // Demote the previous latest to historical, then insert the new row.
  // (Single-tenant writes — the small race window before the new insert
  // would merely cause an older version to briefly be "not latest" while
  // no row yet holds `is_latest=true`, which resolvePrompt reports as
  // "not found". Acceptable for a low-contention admin surface.)
  await db.update(prompt)
    .set({ isLatest: false })
    .where(and(eq(prompt.tenantId, tenantId), eq(prompt.slug, slug), eq(prompt.isLatest, true)))

  await db.insert(prompt).values({
    id,
    tenantId,
    slug,
    version: nextVersion,
    template: template as Array<Record<string, unknown>>,
    variables: variables ?? null,
    defaultModel: defaultModel ?? null,
    description: description ?? null,
    isLatest: true,
    isActive: true,
  })

  await invalidatePromptCache(tenantId, slug)

  logger.info({ id, tenantId, slug, version: nextVersion }, "prompt created")

  return c.json({
    id,
    slug,
    tenantId,
    version: nextVersion,
    template,
    variables: variables ?? null,
    defaultModel: defaultModel ?? null,
    description: description ?? null,
    isLatest: true,
    createdAt: new Date().toISOString(),
  }, 201)
})

// GET /admin/prompts?tenantId=...  — latest version per slug for a tenant
promptsRouter.get("/", requireAdmin(), async (c) => {
  const tenantId = c.req.query("tenantId")
  if (!tenantId) return c.json({ error: { code: "BAD_REQUEST", message: "tenantId required" } }, 400)

  const rows = await db.select().from(prompt)
    .where(and(eq(prompt.tenantId, tenantId), eq(prompt.isLatest, true), eq(prompt.isActive, true)))
    .orderBy(desc(prompt.createdAt))

  return c.json({ data: rows })
})

// GET /admin/prompts/by-slug/:slug?tenantId=... — latest version for a slug
promptsRouter.get("/by-slug/:slug", requireAdmin(), async (c) => {
  const slug = c.req.param("slug")
  const tenantId = c.req.query("tenantId")
  if (!tenantId) return c.json({ error: { code: "BAD_REQUEST", message: "tenantId required" } }, 400)

  const rows = await db.select().from(prompt)
    .where(and(
      eq(prompt.tenantId, tenantId),
      eq(prompt.slug, slug),
      eq(prompt.isLatest, true),
      eq(prompt.isActive, true),
    ))
    .limit(1)

  if (!rows.length) return c.json({ error: { code: "NOT_FOUND", message: "Prompt not found" } }, 404)
  return c.json(rows[0])
})

// GET /admin/prompts/:slug/versions?tenantId=... — full version history
promptsRouter.get("/:slug/versions", requireAdmin(), async (c) => {
  const slug = c.req.param("slug")
  const tenantId = c.req.query("tenantId")
  if (!tenantId) return c.json({ error: { code: "BAD_REQUEST", message: "tenantId required" } }, 400)

  const rows = await db.select().from(prompt)
    .where(and(eq(prompt.tenantId, tenantId), eq(prompt.slug, slug)))
    .orderBy(desc(prompt.version))

  return c.json({ data: rows })
})

// GET /admin/prompts/:id — fetch by primary key
promptsRouter.get("/:id", requireAdmin(), async (c) => {
  const id = c.req.param("id")
  if (!id.startsWith("prm_")) {
    return c.json({ error: { code: "NOT_FOUND", message: "Prompt not found" } }, 404)
  }

  const rows = await db.select().from(prompt)
    .where(and(eq(prompt.id, id), eq(prompt.isActive, true)))
    .limit(1)

  if (!rows.length) return c.json({ error: { code: "NOT_FOUND", message: "Prompt not found" } }, 404)
  return c.json(rows[0])
})

// DELETE /admin/prompts/:id — soft-delete (is_active=false).
// If the row was `is_latest`, promote the next-highest active version to
// latest so the slug keeps resolving. If none remain, the slug goes dark.
promptsRouter.delete("/:id", requireAdmin(), async (c) => {
  const id = c.req.param("id")
  if (!id.startsWith("prm_")) {
    return c.json({ error: { code: "NOT_FOUND", message: "Prompt not found" } }, 404)
  }

  const existing = await db.select().from(prompt).where(eq(prompt.id, id)).limit(1)
  if (!existing.length) return c.json({ error: { code: "NOT_FOUND", message: "Prompt not found" } }, 404)

  const { tenantId, slug, isLatest } = existing[0]

  await db.update(prompt)
    .set({ isActive: false, isLatest: false })
    .where(eq(prompt.id, id))

  if (isLatest) {
    // Promote the highest-version active row for this slug
    const candidates = await db.select().from(prompt)
      .where(and(eq(prompt.tenantId, tenantId), eq(prompt.slug, slug), eq(prompt.isActive, true)))
      .orderBy(desc(prompt.version))
      .limit(1)
    if (candidates.length) {
      await db.update(prompt).set({ isLatest: true }).where(eq(prompt.id, candidates[0].id))
    }
  }

  await invalidatePromptCache(tenantId, slug, id)

  logger.info({ id, tenantId, slug }, "prompt deleted")
  return c.json({ id, deleted: true })
})
