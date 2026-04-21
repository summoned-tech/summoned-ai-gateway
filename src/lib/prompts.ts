import { and, desc, eq } from "drizzle-orm"
import { db, prompt } from "@/lib/db"
import { redis, isRedisEnabled } from "@/lib/redis"
import { logger } from "@/lib/telemetry"

/**
 * Prompt management — versioned templates resolved at request time.
 * See rfcs/0001-prompt-management.md.
 *
 * promptId accepts three forms:
 *   "<slug>"             → latest version for tenant
 *   "<slug>@<version>"   → pinned version
 *   "<row-id>"           → pinned by primary key (prm_...)
 */

const CACHE_PREFIX = "prompt:"
const CACHE_TTL_SECONDS = 60
const MAX_TEMPLATE_BYTES = 256 * 1024

export interface ResolvedPrompt {
  id: string
  slug: string
  version: number
  template: Array<Record<string, unknown>>
  defaultModel: string | null
  variableDefaults: Record<string, string>
}

type PromptRef =
  | { kind: "id"; id: string }
  | { kind: "slug"; slug: string; version: number | null }

export function parsePromptRef(ref: string): PromptRef {
  if (ref.startsWith("prm_")) return { kind: "id", id: ref }
  const at = ref.lastIndexOf("@")
  if (at === -1) return { kind: "slug", slug: ref, version: null }
  const slug = ref.slice(0, at)
  const versionRaw = ref.slice(at + 1)
  const version = Number.parseInt(versionRaw, 10)
  if (!Number.isFinite(version) || version < 1) {
    return { kind: "slug", slug: ref, version: null }
  }
  return { kind: "slug", slug, version }
}

function cacheKey(tenantId: string, ref: PromptRef): string {
  if (ref.kind === "id") return `${CACHE_PREFIX}id:${ref.id}`
  return `${CACHE_PREFIX}${tenantId}:${ref.slug}:${ref.version ?? "latest"}`
}

export async function invalidatePromptCache(tenantId: string, slug: string, id?: string): Promise<void> {
  if (!isRedisEnabled) return
  const keys = [`${CACHE_PREFIX}${tenantId}:${slug}:latest`]
  if (id) keys.push(`${CACHE_PREFIX}id:${id}`)
  for (const key of keys) {
    try {
      await redis.del(key)
    } catch (err) {
      logger.warn({ err, key }, "failed to invalidate prompt cache")
    }
  }
}

/**
 * Fetch a prompt row, using Redis when available. Returns null if not found
 * or inactive. Never throws — resolution failures surface as null and the
 * caller decides how to respond.
 */
export async function resolvePrompt(promptId: string, tenantId: string): Promise<ResolvedPrompt | null> {
  const ref = parsePromptRef(promptId)
  const key = cacheKey(tenantId, ref)

  if (isRedisEnabled) {
    try {
      const cached = await redis.get(key)
      if (cached) return JSON.parse(cached) as ResolvedPrompt
    } catch (err) {
      logger.warn({ err, key }, "prompt cache read failed")
    }
  }

  const row = await fetchPromptRow(ref, tenantId)
  if (!row) return null

  const resolved: ResolvedPrompt = {
    id: row.id,
    slug: row.slug,
    version: row.version,
    template: row.template,
    defaultModel: row.defaultModel ?? null,
    variableDefaults: row.variables ?? {},
  }

  if (isRedisEnabled) {
    try {
      await redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(resolved))
    } catch (err) {
      logger.warn({ err, key }, "prompt cache write failed")
    }
  }

  return resolved
}

async function fetchPromptRow(ref: PromptRef, tenantId: string) {
  if (ref.kind === "id") {
    const rows = await db.select().from(prompt)
      .where(and(eq(prompt.id, ref.id), eq(prompt.tenantId, tenantId), eq(prompt.isActive, true)))
      .limit(1)
    return rows[0] ?? null
  }

  if (ref.version === null) {
    const rows = await db.select().from(prompt)
      .where(and(
        eq(prompt.tenantId, tenantId),
        eq(prompt.slug, ref.slug),
        eq(prompt.isLatest, true),
        eq(prompt.isActive, true),
      ))
      .limit(1)
    return rows[0] ?? null
  }

  const rows = await db.select().from(prompt)
    .where(and(
      eq(prompt.tenantId, tenantId),
      eq(prompt.slug, ref.slug),
      eq(prompt.version, ref.version),
      eq(prompt.isActive, true),
    ))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Replace `{{name}}` placeholders in every string content field of the
 * template's messages. Whitespace-tolerant: `{{ name }}` works too.
 *
 * Missing variables are left literal — surfaces the bug rather than silently
 * shipping an empty string. See RFC 0001 for rationale.
 */
const PLACEHOLDER_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g

export function interpolate(
  template: Array<Record<string, unknown>>,
  vars: Record<string, string>,
  defaults: Record<string, string>,
): Array<Record<string, unknown>> {
  const merged: Record<string, string> = { ...defaults }
  for (const [k, v] of Object.entries(vars)) {
    merged[k] = typeof v === "string" ? v : String(v)
  }

  return template.map((msg) => replaceInMessage(msg, merged))
}

function replaceInMessage(msg: Record<string, unknown>, vars: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...msg }
  const content = msg.content
  if (typeof content === "string") {
    out.content = replaceString(content, vars)
  } else if (Array.isArray(content)) {
    out.content = content.map((part: any) => {
      if (part && typeof part === "object" && typeof part.text === "string") {
        return { ...part, text: replaceString(part.text, vars) }
      }
      return part
    })
  }
  return out
}

function replaceString(input: string, vars: Record<string, string>): string {
  return input.replace(PLACEHOLDER_RE, (match, name) => {
    if (name in vars) return vars[name]
    return match
  })
}

/**
 * Serialised byte size guard for the admin create path. Callers should
 * reject templates above this threshold with a 400.
 */
export function templateByteSize(template: unknown): number {
  return Buffer.byteLength(JSON.stringify(template), "utf-8")
}

export const PROMPT_MAX_TEMPLATE_BYTES = MAX_TEMPLATE_BYTES
