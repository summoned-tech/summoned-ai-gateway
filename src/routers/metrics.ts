import { Hono } from "hono"
import { metricsRegistry } from "@/lib/telemetry"

export const metricsRouter = new Hono()

metricsRouter.get("/", async (c) => {
  const metrics = await metricsRegistry.metrics()
  c.header("Content-Type", metricsRegistry.contentType)
  return c.text(metrics)
})
