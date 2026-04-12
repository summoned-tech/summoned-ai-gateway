import { Hono } from "hono"
import { embed, embedMany } from "ai"
import { nanoid } from "nanoid"
import { z } from "zod"

import { registry } from "@/providers/registry"
import { calculateCost } from "@/lib/pricing"
import { logger } from "@/lib/telemetry"
import type { AuthContext } from "@/middlewares/auth"

const embeddingRequestSchema = z.object({
  model: z.string(),
  input: z.union([z.string(), z.array(z.string())]),
  encoding_format: z.enum(["float", "base64"]).default("float"),
})

export const embeddingsRouter = new Hono<{ Variables: AuthContext }>()

embeddingsRouter.post("/embeddings", async (c: any) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON body" } }, 400)

  const parsed = embeddingRequestSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Invalid request", details: parsed.error.flatten() } }, 400)
  }

  const req = parsed.data
  const startTime = Date.now()

  try {
    const { model, provider, modelId } = registry.getEmbeddingModel(req.model)
    const inputs = Array.isArray(req.input) ? req.input : [req.input]

    let data: { embedding: number[]; index: number }[]
    let totalTokens = 0

    if (inputs.length === 1) {
      const result = await embed({ model, value: inputs[0] })
      data = [{ embedding: result.embedding, index: 0 }]
      totalTokens = result.usage?.tokens ?? 0
    } else {
      const result = await embedMany({ model, values: inputs })
      data = result.embeddings.map((emb, i) => ({ embedding: emb, index: i }))
      totalTokens = result.usage?.tokens ?? 0
    }

    const latencyMs = Date.now() - startTime
    const cost = calculateCost(provider.id, modelId, totalTokens, 0)

    return c.json({
      object: "list",
      data: data.map((d) => ({
        object: "embedding",
        index: d.index,
        embedding: d.embedding,
      })),
      model: req.model,
      usage: { prompt_tokens: totalTokens, total_tokens: totalTokens },
      summoned: {
        provider: provider.id,
        resolved_model: modelId,
        cost: cost,
        latency_ms: latencyMs,
      },
    })
  } catch (err) {
    logger.error({ err, model: req.model }, "embedding request failed")
    return c.json({
      error: { code: "UPSTREAM_ERROR", message: err instanceof Error ? err.message : String(err) },
    }, 502)
  }
})
