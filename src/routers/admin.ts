import { Hono } from "hono"
import { desc, eq, sql, and, gte, lte } from "drizzle-orm"
import { db, requestLog, apiKey } from "@/lib/db"
import { getRecentLogs, getLogCount } from "@/lib/log-buffer"
import { registry } from "@/providers/registry"
import { getProviderHealth } from "@/lib/circuit-breaker"
import { env } from "@/lib/env"

const admin = new Hono()

admin.use("*", async (c: any, next: any) => {
  if (c.get("consoleAuth")) return next()
  const key = c.req.header("x-admin-key")
  if (!key || key !== env.ADMIN_API_KEY) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid admin key" } }, 401)
  }
  return next()
})

// ---------------------------------------------------------------------------
// GET /admin/logs — recent logs from in-memory buffer (fast) or DB (historical)
// ---------------------------------------------------------------------------

admin.get("/logs", async (c: any) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 500)
  const source = c.req.query("source") ?? "buffer"

  if (source === "buffer") {
    return c.json({ data: getRecentLogs(limit), source: "buffer", total: getLogCount() })
  }

  const tenantId = c.req.query("tenantId")
  const status = c.req.query("status")
  const from = c.req.query("from")
  const to = c.req.query("to")

  const conditions: any[] = []
  if (tenantId) conditions.push(eq(requestLog.tenantId, tenantId))
  if (status) conditions.push(eq(requestLog.status, status as any))
  if (from) conditions.push(gte(requestLog.createdAt, new Date(from)))
  if (to) conditions.push(lte(requestLog.createdAt, new Date(to)))

  const rows = await db
    .select()
    .from(requestLog)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(requestLog.createdAt))
    .limit(limit)

  return c.json({ data: rows, source: "database", count: rows.length })
})

// ---------------------------------------------------------------------------
// GET /admin/stats — aggregate statistics
// ---------------------------------------------------------------------------

admin.get("/stats", async (c: any) => {
  const period = c.req.query("period") ?? "24h"
  const hours = period === "7d" ? 168 : period === "30d" ? 720 : 24
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const [totals] = await db
    .select({
      totalRequests: sql<number>`count(*)`,
      successCount: sql<number>`count(*) filter (where ${requestLog.status} = 'success')`,
      errorCount: sql<number>`count(*) filter (where ${requestLog.status} = 'error')`,
      totalInputTokens: sql<number>`coalesce(sum(${requestLog.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`coalesce(sum(${requestLog.outputTokens}), 0)`,
      avgLatencyMs: sql<number>`coalesce(avg(${requestLog.latencyMs}), 0)`,
      p50LatencyMs: sql<number>`coalesce(percentile_cont(0.5) within group (order by ${requestLog.latencyMs}), 0)`,
      p95LatencyMs: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${requestLog.latencyMs}), 0)`,
      p99LatencyMs: sql<number>`coalesce(percentile_cont(0.99) within group (order by ${requestLog.latencyMs}), 0)`,
    })
    .from(requestLog)
    .where(gte(requestLog.createdAt, since))

  const topModels = await db
    .select({
      model: requestLog.resolvedModel,
      provider: requestLog.provider,
      count: sql<number>`count(*)`,
      totalTokens: sql<number>`coalesce(sum(${requestLog.inputTokens}) + sum(${requestLog.outputTokens}), 0)`,
    })
    .from(requestLog)
    .where(gte(requestLog.createdAt, since))
    .groupBy(requestLog.resolvedModel, requestLog.provider)
    .orderBy(sql`count(*) desc`)
    .limit(10)

  const activeKeys = await db
    .select({ count: sql<number>`count(*)` })
    .from(apiKey)
    .where(eq(apiKey.isActive, true))

  return c.json({
    period,
    since: since.toISOString(),
    requests: {
      total: Number(totals.totalRequests),
      success: Number(totals.successCount),
      errors: Number(totals.errorCount),
      errorRate: totals.totalRequests > 0
        ? Number(((totals.errorCount / totals.totalRequests) * 100).toFixed(2))
        : 0,
    },
    tokens: {
      input: Number(totals.totalInputTokens),
      output: Number(totals.totalOutputTokens),
      total: Number(totals.totalInputTokens) + Number(totals.totalOutputTokens),
    },
    latency: {
      avg: Math.round(Number(totals.avgLatencyMs)),
      p50: Math.round(Number(totals.p50LatencyMs)),
      p95: Math.round(Number(totals.p95LatencyMs)),
      p99: Math.round(Number(totals.p99LatencyMs)),
    },
    topModels,
    activeApiKeys: Number(activeKeys[0]?.count ?? 0),
    providers: registry.allIds(),
  })
})

// ---------------------------------------------------------------------------
// GET /admin/providers — list enabled providers + health status
// ---------------------------------------------------------------------------

admin.get("/providers", (c: any) => {
  const health = getProviderHealth()
  const providers = registry.all().map((p) => ({
    id: p.id,
    name: p.name,
    supportsEmbeddings: !!p.getEmbeddingModel,
    health: health[p.id] ?? { state: "closed", failures: 0 },
  }))
  return c.json({ data: providers })
})

export { admin as adminRouter }
