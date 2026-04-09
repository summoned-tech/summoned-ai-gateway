import { Hono } from "hono"
import { streamText, generateText, jsonSchema, type ModelMessage } from "ai"
import { nanoid } from "nanoid"
import { z } from "zod"

import { db, requestLog } from "@/lib/db"
import { logger, getTracer, spanError, SpanStatusCode, completionRequestCounter, completionTokensCounter, completionLatency, activeCompletions, type Span } from "@/lib/telemetry"
import { getBedrockModel, resolveBedrockModelId, listAvailableModels } from "@/providers/bedrock"
import { tryWithFallback, isRetryableError } from "@/lib/fallback"
import type { AuthContext } from "@/middlewares/auth"

const tracer = getTracer()

// ---------------------------------------------------------------------------
// OpenAI-compatible request schema
// ---------------------------------------------------------------------------

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(z.any())]),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(z.any()).optional(),
  name: z.string().optional(),
}).passthrough()

const toolSchema = z.object({
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.any().optional(),
  }),
})

const completionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(messageSchema),
  stream: z.boolean().default(false),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  tools: z.array(toolSchema).optional(),
  tool_choice: z.any().optional(),
  top_p: z.number().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  fallback_models: z.array(z.string()).max(3).optional(),
}).passthrough()

// ---------------------------------------------------------------------------
// Helpers — convert OpenAI format ↔ Vercel AI SDK format
// ---------------------------------------------------------------------------

function openAiMessagesToCore(messages: z.infer<typeof messageSchema>[]): { system?: string; messages: ModelMessage[] } {
  let system: string | undefined
  const coreMessages: ModelMessage[] = []

  for (const msg of messages) {
    if (msg.role === "system") {
      system = typeof msg.content === "string" ? msg.content : msg.content.map((p: any) => p.text ?? "").join("")
      continue
    }

    if (msg.role === "user") {
      const content = typeof msg.content === "string"
        ? msg.content
        : msg.content.map((p: any) => ({ type: p.type === "text" ? "text" : p.type, text: p.text ?? "" }))
      coreMessages.push({ role: "user", content: content as any })
      continue
    }

    if (msg.role === "assistant") {
      if (msg.tool_calls?.length) {
        coreMessages.push({
          role: "assistant",
          content: msg.tool_calls.map((tc: any) => ({
            type: "tool-call",
            toolCallId: tc.id,
            toolName: tc.function.name,
            args: JSON.parse(tc.function.arguments ?? "{}"),
          })),
        })
      } else {
        const text = typeof msg.content === "string" ? msg.content : msg.content.map((p: any) => p.text ?? "").join("")
        coreMessages.push({ role: "assistant", content: text })
      }
      continue
    }

    if (msg.role === "tool") {
      coreMessages.push({
        role: "tool",
        content: [{
          type: "tool-result",
          toolCallId: msg.tool_call_id ?? "",
          toolName: msg.name ?? "",
          result: typeof msg.content === "string" ? msg.content : msg.content,
        }],
      })
    }
  }

  return { system, messages: coreMessages }
}

/**
 * Strip fields from JSON Schema that Bedrock rejects ($schema, additionalProperties).
 * Recurse into nested objects and array items.
 */
function cleanSchemaForBedrock(schema: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...schema }
  delete cleaned["$schema"]
  delete cleaned["additionalProperties"]

  if (cleaned.properties && typeof cleaned.properties === "object") {
    const props = cleaned.properties as Record<string, Record<string, unknown>>
    const cleanedProps: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(props)) {
      cleanedProps[k] = v && typeof v === "object" ? cleanSchemaForBedrock(v) : v
    }
    cleaned.properties = cleanedProps
  }
  if (cleaned.items && typeof cleaned.items === "object") {
    cleaned.items = cleanSchemaForBedrock(cleaned.items as Record<string, unknown>)
  }
  return cleaned
}

// Store original clean schemas so the fetch interceptor can replace broken ones
const _toolSchemaCache = new Map<string, Record<string, unknown>>()

function openAiToolsToTools(tools: z.infer<typeof toolSchema>[]): Record<string, any> {
  const result: Record<string, any> = {}
  _toolSchemaCache.clear()
  for (const t of tools) {
    const raw = t.function.parameters ?? { type: "object", properties: {} }
    const clean = cleanSchemaForBedrock({ type: "object", properties: {}, ...raw } as Record<string, unknown>)
    _toolSchemaCache.set(t.function.name, clean)

    result[t.function.name] = {
      description: t.function.description,
      parameters: jsonSchema(clean as any),
    }
  }
  return result
}

/** Exported for the fetch interceptor in bedrock.ts */
export { _toolSchemaCache }

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export const completionsRouter = new Hono<{ Variables: AuthContext }>()

type CompletionContext = { Variables: AuthContext }

// GET /v1/models — list available models (OpenAI compat)
completionsRouter.get("/models", (c: Parameters<Parameters<typeof completionsRouter.get>[1]>[0]) => {
  return c.json({ object: "list", data: listAvailableModels() })
})

// POST /v1/chat/completions — main completion endpoint
completionsRouter.post("/chat/completions", async (c: Parameters<Parameters<typeof completionsRouter.post>[1]>[0]) => {
  const apiKeyId = c.get("apiKeyId")
  const tenantId = c.get("tenantId")
  const userId = c.req.header("x-user-id") ?? null
  const organizationId = c.req.header("x-organization-id") ?? null
  const requestId = c.res.headers.get("x-request-id") ?? nanoid()

  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: { code: "BAD_REQUEST", message: "Invalid JSON body" } }, 400)

  const parsed = completionRequestSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Invalid request", details: parsed.error.flatten() } }, 400)
  }

  const req = parsed.data

  // Build the model chain: primary first, then customer-defined fallbacks
  const modelChain = [req.model, ...(req.fallback_models ?? [])]

  const logId = nanoid()
  const startTime = Date.now()

  return tracer.startActiveSpan("gateway.completion", async (span: Span) => {
    span.setAttributes({
      "gateway.request_id": requestId,
      "gateway.tenant_id": tenantId,
      "llm.model.requested": req.model,
      "llm.model.chain": modelChain.join(","),
      "llm.streaming": req.stream,
    })

    const { system, messages } = openAiMessagesToCore(req.messages)
    const tools = req.tools?.length ? openAiToolsToTools(req.tools) : undefined

    const baseOptions = {
      messages,
      ...(system ? { system } : {}),
      ...(tools ? { tools } : {}),
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(req.max_tokens ? { maxTokens: req.max_tokens } : {}),
    }

    // -------------------------------------------------------------------------
    // Non-streaming — full transparent fallback across the chain
    // -------------------------------------------------------------------------

    if (!req.stream) {
      try {
        const { result, modelAlias, attemptIndex, fallbackAttempts } = await tryWithFallback(
          modelChain,
          async (alias) => {
            const model = await getBedrockModel(alias)
            const r = await generateText({ ...baseOptions, model })
            return { r, resolvedModel: resolveBedrockModelId(alias) }
          },
        )

        const { r, resolvedModel } = result
        const latencyMs = Date.now() - startTime
        const inputTokens = r.usage?.promptTokens ?? 0
        const outputTokens = r.usage?.completionTokens ?? 0

        completionRequestCounter.inc({ provider: "bedrock", model: resolvedModel, status: "success" })
        completionTokensCounter.inc({ provider: "bedrock", model: resolvedModel, type: "input" }, inputTokens)
        completionTokensCounter.inc({ provider: "bedrock", model: resolvedModel, type: "output" }, outputTokens)
        completionLatency.observe({ provider: "bedrock", model: resolvedModel }, latencyMs / 1000)

        span.setAttributes({
          "llm.model.served_by": modelAlias,
          "llm.model.resolved": resolvedModel,
          "llm.fallback_attempts": attemptIndex,
          "llm.input_tokens": inputTokens,
          "llm.output_tokens": outputTokens,
          "llm.latency_ms": latencyMs,
        })
        span.setStatus({ code: SpanStatusCode.OK })

        const choices: any[] = r.toolCalls?.length
          ? [{
              index: 0,
              message: {
                role: "assistant",
                content: null,
                tool_calls: r.toolCalls.map((tc: any) => ({
                  id: tc.toolCallId,
                  type: "function",
                  function: { name: tc.toolName, arguments: JSON.stringify(tc.args) },
                })),
              },
              finish_reason: "tool_calls",
            }]
          : [{ index: 0, message: { role: "assistant", content: r.text }, finish_reason: "stop" }]

        const response = {
          id: `chatcmpl-${nanoid(29)}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          // Always report the original requested model — customer's code doesn't need to know we fell back
          model: req.model,
          choices,
          usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
          // Summoned-specific: expose which model actually served + what failed
          summoned: {
            served_by: modelAlias,
            fallback_attempts: fallbackAttempts,
          },
        }

        db.insert(requestLog).values({
          id: logId, apiKeyId, tenantId, userId, organizationId,
          requestedModel: req.model, resolvedModel, provider: "bedrock",
          inputTokens, outputTokens, latencyMs, streaming: false, status: "success",
        }).catch((err: unknown) => logger.error({ err }, "failed to write request log"))

        span.end()

        // Tell the client which model actually served via response header
        return c.json(response, 200, { "X-Summoned-Served-By": modelAlias })
      } catch (err) {
        spanError(span, err)
        span.end()
        const latencyMs = Date.now() - startTime

        completionRequestCounter.inc({ provider: "bedrock", model: req.model, status: "error" })

        db.insert(requestLog).values({
          id: logId, apiKeyId, tenantId, userId, organizationId,
          requestedModel: req.model, resolvedModel: req.model, provider: "bedrock",
          latencyMs, streaming: false, status: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
        }).catch(() => {})

        logger.error({ err, requestId, tenantId, modelChain }, "all models in chain failed")
        return c.json({ error: { code: "UPSTREAM_ERROR", message: "All models in fallback chain failed", requestId } }, 502)
      }
    }

    // -------------------------------------------------------------------------
    // Streaming — fallback before first content chunk reaches the client.
    // Strategy: try each model in the chain, buffer chunks until we confirm the
    // stream is healthy (first text-delta or tool-call-start received).
    // Only then open the SSE response and flush the buffer + continue streaming.
    // If the stream fails before any content, silently try the next model.
    // -------------------------------------------------------------------------

    activeCompletions.inc()
    const completionId = `chatcmpl-${nanoid(29)}`
    const created = Math.floor(Date.now() / 1000)
    const encoder = new TextEncoder()

    let servedByAlias = req.model
    let streamingFallbackAttempts: Array<{ model: string; error: string }> = []

    // Try each model until we get a working stream or exhaust the chain
    type BufferedStream = {
      bufferedChunks: Uint8Array[]
      fullStream: AsyncIterable<any>
      resolvedModel: string
      modelAlias: string
    }

    let activeStream: BufferedStream | null = null

    for (let i = 0; i < modelChain.length; i++) {
      const alias = modelChain[i]
      const resolvedModel = resolveBedrockModelId(alias)
      const isLast = i === modelChain.length - 1

      try {
        const model = await getBedrockModel(alias)
        const stream = streamText({ ...baseOptions, model })

        // Buffer chunks until we get the first meaningful content
        // This confirms the model accepted the request before we commit to the response
        const bufferedChunks: Uint8Array[] = []
        const baseChunk = { id: completionId, object: "chat.completion.chunk", created, model: req.model }

        // Send role header chunk (buffered)
        const roleChunk = encoder.encode(
          `data: ${JSON.stringify({ ...baseChunk, choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] })}\n\n`
        )
        bufferedChunks.push(roleChunk)

        // Peek at the stream — get the async iterator
        const iter = stream.fullStream[Symbol.asyncIterator]()
        let firstContentSeen = false
        const pendingParts: any[] = []

        // Read up to first content part to confirm stream is healthy
        while (!firstContentSeen) {
          const { value: part, done } = await iter.next()
          if (done) break

          pendingParts.push(part)

          if (part.type === "text-delta" || part.type === "tool-call-streaming-start") {
            firstContentSeen = true
          } else if (part.type === "error") {
            throw new Error(part.error?.message ?? "Stream error before content")
          }
        }

        // Stream is healthy — buffer the peeked parts and mark this model as the winner
        const toolCallIndexMap = new Map<string, number>()
        let toolCallIndexCounter = 0

        function partToChunk(part: any): Uint8Array | null {
          if (part.type === "text-delta") {
            return encoder.encode(`data: ${JSON.stringify({ ...baseChunk, choices: [{ index: 0, delta: { content: part.textDelta }, finish_reason: null }] })}\n\n`)
          }
          if (part.type === "tool-call-streaming-start") {
            const idx = toolCallIndexCounter++
            toolCallIndexMap.set(part.toolCallId, idx)
            return encoder.encode(`data: ${JSON.stringify({ ...baseChunk, choices: [{ index: 0, delta: { tool_calls: [{ index: idx, id: part.toolCallId, type: "function", function: { name: part.toolName, arguments: "" } }] }, finish_reason: null }] })}\n\n`)
          }
          if (part.type === "tool-call-delta") {
            const idx = toolCallIndexMap.get(part.toolCallId) ?? 0
            return encoder.encode(`data: ${JSON.stringify({ ...baseChunk, choices: [{ index: 0, delta: { tool_calls: [{ index: idx, function: { arguments: part.argsTextDelta } }] }, finish_reason: null }] })}\n\n`)
          }
          return null
        }

        for (const part of pendingParts) {
          const chunk = partToChunk(part)
          if (chunk) bufferedChunks.push(chunk)
        }

        activeStream = { bufferedChunks, fullStream: { [Symbol.asyncIterator]: () => iter }, resolvedModel, modelAlias: alias }
        servedByAlias = alias

        if (i > 0) {
          logger.warn({ primaryModel: modelChain[0], servedBy: alias, streamingFallbackAttempts }, "streaming request served by fallback")
        }

        // Flush remaining peeked state into the closure
        const capturedToolCallIndexMap = toolCallIndexMap
        let capturedToolCallIndexCounter = toolCallIndexCounter

        // Override partToChunk to use captured state
        activeStream.fullStream = {
          [Symbol.asyncIterator]() {
            return {
              next: () => iter.next(),
              return: (iter as any).return?.bind(iter),
              throw: (iter as any).throw?.bind(iter),
              _toolCallIndexMap: capturedToolCallIndexMap,
              _toolCallIndexCounter: capturedToolCallIndexCounter,
            } as any
          },
        }

        break
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        streamingFallbackAttempts.push({ model: alias, error })

        if (isLast || !isRetryableError(err)) {
          // All models failed or error is non-retryable
          activeCompletions.dec()
          completionRequestCounter.inc({ provider: "bedrock", model: resolveBedrockModelId(req.model), status: "error" })

          db.insert(requestLog).values({
            id: logId, apiKeyId, tenantId, userId, organizationId,
            requestedModel: req.model, resolvedModel: resolveBedrockModelId(req.model),
            provider: "bedrock", latencyMs: Date.now() - startTime,
            streaming: true, status: "error", errorMessage: error,
          }).catch(() => {})

          spanError(span, err)
          span.end()
          return c.json({ error: { code: "UPSTREAM_ERROR", message: "All models in fallback chain failed", requestId } }, 502)
        }

        logger.warn({ model: alias, error, nextModel: modelChain[i + 1] }, "streaming model failed before content, trying fallback")
      }
    }

    if (!activeStream) {
      activeCompletions.dec()
      span.end()
      return c.json({ error: { code: "UPSTREAM_ERROR", message: "No model available", requestId } }, 502)
    }

    // We have a confirmed working stream — build the SSE response
    const { bufferedChunks, fullStream, resolvedModel } = activeStream

    const readable = new ReadableStream({
      async start(controller) {
        // Flush buffered chunks first
        for (const chunk of bufferedChunks) {
          controller.enqueue(chunk)
        }

        let inputTokens = 0
        let outputTokens = 0
        const toolCallIndexMap = new Map<string, number>()
        let toolCallIndexCounter = 0

        const baseChunk = { id: completionId, object: "chat.completion.chunk", created, model: req.model }

        try {
          for await (const part of fullStream) {
            if (part.type === "text-delta") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...baseChunk, choices: [{ index: 0, delta: { content: part.textDelta }, finish_reason: null }] })}\n\n`))
            } else if (part.type === "tool-call-streaming-start") {
              const idx = toolCallIndexCounter++
              toolCallIndexMap.set(part.toolCallId, idx)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...baseChunk, choices: [{ index: 0, delta: { tool_calls: [{ index: idx, id: part.toolCallId, type: "function", function: { name: part.toolName, arguments: "" } }] }, finish_reason: null }] })}\n\n`))
            } else if (part.type === "tool-call-delta") {
              const idx = toolCallIndexMap.get(part.toolCallId) ?? 0
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...baseChunk, choices: [{ index: 0, delta: { tool_calls: [{ index: idx, function: { arguments: part.argsTextDelta } }] }, finish_reason: null }] })}\n\n`))
            } else if (part.type === "finish") {
              const finishReason = part.finishReason === "tool-calls" ? "tool_calls" : "stop"
              if (part.usage) {
                inputTokens = part.usage.promptTokens ?? 0
                outputTokens = part.usage.completionTokens ?? 0
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...baseChunk, choices: [{ index: 0, delta: {}, finish_reason: finishReason }] })}\n\n`))
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()

          const latencyMs = Date.now() - startTime
          completionRequestCounter.inc({ provider: "bedrock", model: resolvedModel, status: "success" })
          completionTokensCounter.inc({ provider: "bedrock", model: resolvedModel, type: "input" }, inputTokens)
          completionTokensCounter.inc({ provider: "bedrock", model: resolvedModel, type: "output" }, outputTokens)
          completionLatency.observe({ provider: "bedrock", model: resolvedModel }, latencyMs / 1000)

          span.setAttributes({
            "llm.model.served_by": servedByAlias,
            "llm.model.resolved": resolvedModel,
            "llm.input_tokens": inputTokens,
            "llm.output_tokens": outputTokens,
            "llm.latency_ms": latencyMs,
          })
          span.setStatus({ code: SpanStatusCode.OK })

          db.insert(requestLog).values({
            id: logId, apiKeyId, tenantId, userId, organizationId,
            requestedModel: req.model, resolvedModel, provider: "bedrock",
            inputTokens, outputTokens, latencyMs, streaming: true, status: "success",
          }).catch((err: unknown) => logger.error({ err }, "failed to write request log"))
        } catch (err) {
          spanError(span, err)
          const errChunk = JSON.stringify({ error: { code: "UPSTREAM_ERROR", message: "Stream interrupted" } })
          controller.enqueue(encoder.encode(`data: ${errChunk}\n\n`))
          controller.close()

          db.insert(requestLog).values({
            id: logId, apiKeyId, tenantId, userId, organizationId,
            requestedModel: req.model, resolvedModel, provider: "bedrock",
            latencyMs: Date.now() - startTime, streaming: true, status: "error",
            errorMessage: err instanceof Error ? err.message : String(err),
          }).catch(() => {})
        } finally {
          activeCompletions.dec()
          span.end()
        }
      },
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Request-Id": requestId,
        "X-Summoned-Served-By": servedByAlias,
      },
    })
  })
})
