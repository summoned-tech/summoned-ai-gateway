import { Hono } from "hono"
import { db } from "@/lib/db"
import { redis } from "@/lib/redis"
import { sql } from "drizzle-orm"

export const healthRouter = new Hono()

healthRouter.get("/", async (c) => {
  return c.json({ status: "ok", service: "summoned-gateway", uptime: process.uptime() })
})

healthRouter.get("/ready", async (c) => {
  const checks: Record<string, "ok" | "fail"> = {}

  try {
    await db.execute(sql`SELECT 1`)
    checks.postgres = "ok"
  } catch {
    checks.postgres = "fail"
  }

  try {
    await redis.ping()
    checks.redis = "ok"
  } catch {
    checks.redis = "fail"
  }

  const allOk = Object.values(checks).every((v) => v === "ok")
  return c.json({ status: allOk ? "ready" : "degraded", checks }, allOk ? 200 : 503)
})
