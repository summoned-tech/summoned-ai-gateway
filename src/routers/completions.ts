import { Hono } from "hono"
import { streamText, generateText, jsonSchema, type ModelMessage } from "ai"
import { nanoid } from "nanoid"
import { z } from "zod"

import { db, requestLog } from "@/lib/db"
import { logger, getTracer, spanError, SpanStatusCode, completionRequestCounter, completionTokensCounter, completionLatency, activeCompletions, type Span } from "@/lib/telemetry"
import { registry } from "@/providers/registry"
import { _toolSchemaCache } from "@/providers/bedrock"
import { tryWithFallback, isRetryableError } from "@/lib/fallback"
import { parseConfig, type SummonedConfig } from "@/lib/config"
import { calculateCost } from "@/lib/pricing"
import { pushLog } from "@/lib/log-buffer"
import { getCacheKey, getCachedResponse, setCachedResponse } from "@/lib/cache"
import { runGuardrails } from "@/lib/guardrails"
import { resolveVirtualKey, createEphemeralProvider } from "@/lib/provider-resolve"
import { isProviderAvailable, recordSuccess, recordFailure } from "@/lib/circuit-breaker"
import { incrementDailyTokens } from "@/lib/budget"
import { sortByCost, sortByLatency, recordProviderLatency } from "@/lib/routing"
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
  fallback_models: z.array(z.string()).max(5).optional(),
  config: z.any().optional(),
}).passthrough()

// ---------------------------------------------------------------------------
// Helpers — convert OpenAI format <-> Vercel AI SDK format
// ---------------------------------------------------------------------------

function openAiMessagesToCore(messages: z.infer<typeof messageSchema>[]): { system?: string; messages: ModelMessage[] } {
  let system: string | undefined
  const coreMessages: any[] = []

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
          role: "assistant" as const,
          content: msg.tool_calls.map((tc: any) => ({
            type: "tool-call" as const,
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
        role: "tool" as const,
        content: [{
          type: "tool-result" as const,
          toolCallId: msg.tool_call_id ?? "",
          toolName: msg.name ?? "",
          content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        }],
      })
    }
  }

  return { system, messages: coreMessages }
}

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

// Re-export for bedrock fetch interceptor
export { _toolSchemaCache }

// ---------------------------------------------------------------------------
// Model resolution — handles both managed registry and BYOK ephemeral providers
// ---------------------------------------------------------------------------

async function resolveModelForAlias(alias: string, byokKey: string | null) {
  if (!byokKey) {
    return registry.getModel(alias)
  }

  // BYOK: parse "provider/model-id" — default to "openai" if no prefix given
  const slashIdx = alias.indexOf("/")
  const providerId = slashIdx !== -1 ? alias.slice(0, slashIdx) : "openai"
  const modelId = slashIdx !== -1 ? alias.slice(slashIdx + 1) : alias

  const adapter = await createEphemeralProvider(providerId, byokKey)
  if (!adapter) {
    throw new Error(`Unknown provider "${providerId}". Use "provider/model" format, e.g. "openai/gpt-4o".`)
  }

  const model = adapter.getModel(modelId)
  return { model, provider: adapter, modelId }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export const completionsRouter = new Hono<{ Variables: AuthContext }>()

// Helper: write to DB (when available) + push to in-memory log buffer
function emitLog(vals: {
  id: string; apiKeyId: string; tenantId: string; userId?: string | null; organizationId?: string | null;
  requestedModel: string; resolvedModel: string; provider: string;
  inputTokens?: number; outputTokens?: number; latencyMs: number;
  streaming: boolean; status: "success" | "error"; errorMessage?: string;
  costUsd?: number; costInr?: number; cacheHit?: boolean;
}) {
  // Only persist to DB when Postgres is configured; always push to in-memory log buffer
  if (process.env.POSTGRES_URL) {
    db.insert(requestLog).values(vals).catch((err: unknown) => logger.error({ err }, "failed to write request log"))
  }
  pushLog({
    id: vals.id,
    timestamp: new Date().toISOString(),
    provider: vals.provider,
    requestedModel: vals.requestedModel,
    resolvedModel: vals.resolvedModel,
    inputTokens: vals.inputTokens ?? 0,
    outputTokens: vals.outputTokens ?? 0,
    latencyMs: vals.latencyMs,
    streaming: vals.streaming,
    status: vals.status,
    costUsd: vals.costUsd ?? 0,
    costInr: vals.costInr ?? 0,
    tenantId: vals.tenantId,
    apiKeyId: vals.apiKeyId,
    userId: vals.userId,
    errorMessage: vals.errorMessage,
  })
}

// GET /v1/models — list registered providers
// The gateway is a pure proxy: it doesn't maintain a static model catalog.
// Users specify models as "provider/model-id" and the upstream validates.
completionsRouter.get("/models", (c: any) => {
  const providers = registry.all().map((p) => ({
    id: p.id,
    object: "provider" as const,
    name: p.name,
    supportsEmbeddings: !!p.getEmbeddingModel,
    usage: `Use "${p.id}/<model-id>" in the model field, e.g. "${p.id}/gpt-4o"`,
  }))
  return c.json({
    object: "list",
    data: providers,
    hint: "This gateway proxies requests to providers. Use 'provider/model-id' format.",
  })
})

// POST /v1/chat/completions — main completion endpoint (multi-provider)
completionsRouter.post("/chat/completions", async (c: any) => {
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

  // Parse config from header or body
  const config = parseConfig(c.req.header("x-summoned-config"), req.config)
  const traceId = config?.traceId ?? c.req.header("x-trace-id") ?? requestId

  // BYOK: caller supplies their own provider API key via x-provider-key header
  const byokKey = c.req.header("x-provider-key") ?? null

  // Build the model chain: primary + config fallbacks + body fallbacks,
  // then remove providers whose circuit breaker is currently OPEN (unless BYOK).
  const configFallbacks = config?.fallback ?? []
  const bodyFallbacks = req.fallback_models ?? []
  const rawModelChain = [req.model, ...configFallbacks, ...bodyFallbacks]

  // Filter by circuit breaker (BYOK callers skip this — their key, their risk)
  const availableChain = byokKey
    ? rawModelChain
    : rawModelChain.filter((alias) => {
        const providerId = alias.includes("/") ? alias.split("/")[0] : null
        if (!providerId) return true
        const available = isProviderAvailable(providerId)
        if (!available) {
          logger.warn({ alias, providerId }, "circuit breaker OPEN — skipping provider in chain")
        }
        return available
      })

  // Apply routing strategy to determine attempt order
  const routingStrategy = config?.routing ?? "default"
  let modelChain: string[]
  if (routingStrategy === "cost") {
    modelChain = sortByCost(availableChain)
  } else if (routingStrategy === "latency") {
    modelChain = await sortByLatency(availableChain)
  } else {
    modelChain = availableChain // "default" — caller's explicit order wins
  }

  // --- Input guardrails ---
  if (config?.guardrails?.input?.length) {
    const inputText = req.messages
      .map((m: any) => typeof m.content === "string" ? m.content : JSON.stringify(m.content))
      .join("\n")
    const guardResult = runGuardrails(inputText, config.guardrails.input)
    if (!guardResult.passed) {
      return c.json({
        error: {
          code: "GUARDRAIL_VIOLATION",
          message: "Input blocked by guardrails",
          violations: guardResult.violations,
        },
      }, 400)
    }
  }

  const logId = nanoid()
  const startTime = Date.now()

  // --- Cache check (non-streaming only) ---
  let cacheHit = false
  if (config?.cache && !req.stream) {
    const cacheKey = await getCacheKey({
      model: req.model,
      messages: req.messages,
      temperature: req.temperature,
      max_tokens: req.max_tokens,
    })
    const cached = await getCachedResponse(cacheKey)
    if (cached) {
      cacheHit = true
      const latencyMs = Date.now() - startTime
      emitLog({
        id: logId, apiKeyId, tenantId, userId, organizationId,
        requestedModel: req.model, resolvedModel: req.model, provider: "cache",
        latencyMs, streaming: false, status: "success", cacheHit: true,
      })
      return c.json(cached, 200, {
        "X-Summoned-Cache": "HIT",
        "X-Summoned-Trace-Id": traceId,
        "X-Summoned-Latency-Ms": String(latencyMs),
      })
    }
  }

  return tracer.startActiveSpan("gateway.completion", async (span: Span) => {
    span.setAttributes({
      "gateway.request_id": requestId,
      "gateway.trace_id": traceId,
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

    // Apply timeout if configured
    const abortController = config?.timeout ? new AbortController() : undefined
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    if (config?.timeout && abortController) {
      timeoutHandle = setTimeout(() => abortController.abort(), config.timeout)
    }

    // -----------------------------------------------------------------------
    // Non-streaming
    // -----------------------------------------------------------------------

    if (!req.stream) {
      try {
        const { result, modelAlias, attemptIndex, totalRetries, fallbackAttempts } = await tryWithFallback(
          modelChain,
          async (alias) => {
            const { model, provider, modelId } = await resolveModelForAlias(alias, byokKey)
            const r = await generateText({
              ...baseOptions,
              model,
              ...(abortController ? { abortSignal: abortController.signal } : {}),
            })
            recordSuccess(provider.id)
            return { r, provider, modelId }
          },
          config,
        )

        if (timeoutHandle) clearTimeout(timeoutHandle)

        const { r, provider, modelId } = result
        const latencyMs = Date.now() - startTime
        const inputTokens = (r.usage as any)?.promptTokens ?? (r.usage as any)?.inputTokens ?? 0
        const outputTokens = (r.usage as any)?.completionTokens ?? (r.usage as any)?.outputTokens ?? 0
        const cost = calculateCost(provider.id, modelId, inputTokens, outputTokens)

        completionRequestCounter.inc({ provider: provider.id, model: modelId, status: "success" })
        completionTokensCounter.inc({ provider: provider.id, model: modelId, type: "input" }, inputTokens)
        completionTokensCounter.inc({ provider: provider.id, model: modelId, type: "output" }, outputTokens)
        completionLatency.observe({ provider: provider.id, model: modelId }, latencyMs / 1000)

        // Async fire-and-forget: token budget + latency EMA (never block response)
        incrementDailyTokens(apiKeyId, inputTokens + outputTokens)
        recordProviderLatency(provider.id, latencyMs)

        span.setAttributes({
          "llm.provider": provider.id,
          "llm.model.served_by": modelAlias,
          "llm.model.resolved": modelId,
          "llm.fallback_attempts": attemptIndex,
          "llm.retries": totalRetries,
          "llm.input_tokens": inputTokens,
          "llm.output_tokens": outputTokens,
          "llm.latency_ms": latencyMs,
          "llm.cost_usd": cost.costUsd,
          "llm.routing_strategy": routingStrategy,
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

        // --- Output guardrails ---
        const outputText = r.text ?? ""
        if (config?.guardrails?.output?.length) {
          const guardResult = runGuardrails(outputText, config.guardrails.output)
          if (!guardResult.passed) {
            span.end()
            return c.json({
              error: {
                code: "GUARDRAIL_VIOLATION",
                message: "Output blocked by guardrails",
                violations: guardResult.violations,
              },
            }, 400, { "X-Summoned-Trace-Id": traceId })
          }
        }

        const response = {
          id: `chatcmpl-${nanoid(29)}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: req.model,
          choices,
          usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
          summoned: {
            provider: provider.id,
            served_by: modelAlias,
            resolved_model: modelId,
            fallback_attempts: fallbackAttempts,
            retries: totalRetries,
            cost: cost,
            latency_ms: latencyMs,
            routing_strategy: routingStrategy,
            cache: false,
          },
        }

        // --- Cache write ---
        if (config?.cache && !req.stream) {
          const ck = await getCacheKey({ model: req.model, messages: req.messages, temperature: req.temperature, max_tokens: req.max_tokens })
          setCachedResponse(ck, response, config.cacheTtl)
        }

        emitLog({
          id: logId, apiKeyId, tenantId, userId, organizationId,
          requestedModel: req.model, resolvedModel: modelId, provider: provider.id,
          inputTokens, outputTokens, latencyMs, streaming: false, status: "success",
          costUsd: cost.costUsd, costInr: cost.costInr,
        })

        span.end()

        return c.json(response, 200, {
          "X-Summoned-Provider": provider.id,
          "X-Summoned-Served-By": modelAlias,
          "X-Summoned-Cost-USD": cost.costUsd.toFixed(6),
          "X-Summoned-Latency-Ms": String(latencyMs),
          "X-Summoned-Trace-Id": traceId,
          "X-Summoned-Cache": "MISS",
        })
      } catch (err) {
        if (timeoutHandle) clearTimeout(timeoutHandle)
        recordFailure(modelChain[0]?.split("/")[0] ?? "unknown")
        spanError(span, err)
        span.end()
        const latencyMs = Date.now() - startTime

        completionRequestCounter.inc({ provider: "unknown", model: req.model, status: "error" })

        emitLog({
          id: logId, apiKeyId, tenantId, userId, organizationId,
          requestedModel: req.model, resolvedModel: req.model, provider: "unknown",
          latencyMs, streaming: false, status: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
        })

        logger.error({ err, requestId, tenantId, modelChain }, "all models in chain failed")
        return c.json({ error: { code: "UPSTREAM_ERROR", message: "All models in fallback chain failed", requestId } }, 502, {
          "X-Summoned-Trace-Id": traceId,
          "X-Summoned-Latency-Ms": String(latencyMs),
        })
      }
    }

    // -----------------------------------------------------------------------
    // Streaming — fallback before first content chunk reaches the client
    // -----------------------------------------------------------------------

    activeCompletions.inc()
    const completionId = `chatcmpl-${nanoid(29)}`
    const created = Math.floor(Date.now() / 1000)
    const encoder = new TextEncoder()

    let servedByAlias = req.model
    let servedByProvider = "unknown"
    let servedByModelId = req.model
    let streamingFallbackAttempts: Array<{ model: string; error: string }> = []

    type BufferedStream = {
      bufferedChunks: Uint8Array[]
      fullStream: AsyncIterable<any>
      providerId: string
      modelId: string
      modelAlias: string
    }

    let activeStream: BufferedStream | null = null

    for (let i = 0; i < modelChain.length; i++) {
      const alias = modelChain[i]
      const isLast = i === modelChain.length - 1

      try {
        const { model, provider, modelId } = await resolveModelForAlias(alias, byokKey)
        const stream = streamText({
          ...baseOptions,
          model,
          ...(abortController ? { abortSignal: abortController.signal } : {}),
        })

        const bufferedChunks: Uint8Array[] = []
        const baseChunk = { id: completionId, object: "chat.completion.chunk", created, model: req.model }

        const roleChunk = encoder.encode(
          `data: ${JSON.stringify({ ...baseChunk, choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] })}\n\n`
        )
        bufferedChunks.push(roleChunk)

        const iter = stream.fullStream[Symbol.asyncIterator]()
        let firstContentSeen = false
        const pendingParts: any[] = []

        while (!firstContentSeen) {
          const { value: part, done } = await iter.next()
          if (done) break

          pendingParts.push(part)

          if (part.type === "text-delta" || (part as any).type === "text-start" || (part as any).type === "tool-call-streaming-start") {
            firstContentSeen = true
          } else if (part.type === "error") {
            throw new Error((part as any).error?.message ?? "Stream error before content")
          }
        }

        const toolCallIndexMap = new Map<string, number>()
        let toolCallIndexCounter = 0

        function partToChunk(part: any): Uint8Array | null {
          if (part.type === "text-delta") {
            const content = part.text ?? part.textDelta ?? ""
            return encoder.encode(`data: ${JSON.stringify({ ...baseChunk, choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`)
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

        activeStream = {
          bufferedChunks,
          fullStream: { [Symbol.asyncIterator]: () => iter },
          providerId: provider.id,
          modelId,
          modelAlias: alias,
        }
        servedByAlias = alias
        servedByProvider = provider.id
        servedByModelId = modelId

        if (i > 0) {
          logger.warn({ primaryModel: modelChain[0], servedBy: alias, provider: provider.id, streamingFallbackAttempts }, "streaming request served by fallback")
        }

        break
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        streamingFallbackAttempts.push({ model: alias, error })

        if (isLast || !isRetryableError(err)) {
          if (timeoutHandle) clearTimeout(timeoutHandle)
          activeCompletions.dec()
          completionRequestCounter.inc({ provider: "unknown", model: req.model, status: "error" })

          emitLog({
            id: logId, apiKeyId, tenantId, userId, organizationId,
            requestedModel: req.model, resolvedModel: req.model,
            provider: "unknown", latencyMs: Date.now() - startTime,
            streaming: true, status: "error", errorMessage: error,
          })

          spanError(span, err)
          span.end()
          return c.json({ error: { code: "UPSTREAM_ERROR", message: "All models in fallback chain failed", requestId } }, 502)
        }

        logger.warn({ model: alias, error, nextModel: modelChain[i + 1] }, "streaming model failed, trying fallback")
      }
    }

    if (!activeStream) {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      activeCompletions.dec()
      span.end()
      return c.json({ error: { code: "UPSTREAM_ERROR", message: "No model available", requestId } }, 502)
    }

    const { bufferedChunks, fullStream, providerId, modelId } = activeStream

    const readable = new ReadableStream({
      async start(controller) {
        for (const chunk of bufferedChunks) {
          controller.enqueue(chunk)
        }

        let inputTokens = 0
        let outputTokens = 0
        const toolCallIndexMap = new Map<string, number>()
        let toolCallIndexCounter = 0
        const baseChunk = { id: completionId, object: "chat.completion.chunk", created, model: req.model }

        try {
          for await (const rawPart of fullStream) {
            const part = rawPart as any
            if (part.type === "text-delta") {
              const content = part.text ?? part.textDelta ?? ""
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...baseChunk, choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`))
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
                inputTokens = part.usage.promptTokens ?? part.usage.inputTokens ?? 0
                outputTokens = part.usage.completionTokens ?? part.usage.outputTokens ?? 0
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...baseChunk, choices: [{ index: 0, delta: {}, finish_reason: finishReason }] })}\n\n`))
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()

          if (timeoutHandle) clearTimeout(timeoutHandle)

          const latencyMs = Date.now() - startTime
          const cost = calculateCost(providerId, modelId, inputTokens, outputTokens)

          completionRequestCounter.inc({ provider: providerId, model: modelId, status: "success" })
          completionTokensCounter.inc({ provider: providerId, model: modelId, type: "input" }, inputTokens)
          completionTokensCounter.inc({ provider: providerId, model: modelId, type: "output" }, outputTokens)
          completionLatency.observe({ provider: providerId, model: modelId }, latencyMs / 1000)

          // Async fire-and-forget: token budget + latency EMA
          incrementDailyTokens(apiKeyId, inputTokens + outputTokens)
          recordProviderLatency(providerId, latencyMs)

          span.setAttributes({
            "llm.provider": providerId,
            "llm.model.served_by": servedByAlias,
            "llm.model.resolved": modelId,
            "llm.input_tokens": inputTokens,
            "llm.output_tokens": outputTokens,
            "llm.latency_ms": latencyMs,
            "llm.cost_usd": cost.costUsd,
            "llm.routing_strategy": routingStrategy,
          })
          span.setStatus({ code: SpanStatusCode.OK })

          emitLog({
            id: logId, apiKeyId, tenantId, userId, organizationId,
            requestedModel: req.model, resolvedModel: modelId, provider: providerId,
            inputTokens, outputTokens, latencyMs, streaming: true, status: "success",
            costUsd: cost.costUsd, costInr: cost.costInr,
          })
        } catch (err) {
          if (timeoutHandle) clearTimeout(timeoutHandle)
          spanError(span, err)
          const errChunk = JSON.stringify({ error: { code: "UPSTREAM_ERROR", message: "Stream interrupted" } })
          controller.enqueue(encoder.encode(`data: ${errChunk}\n\n`))
          controller.close()

          emitLog({
            id: logId, apiKeyId, tenantId, userId, organizationId,
            requestedModel: req.model, resolvedModel: modelId, provider: providerId,
            latencyMs: Date.now() - startTime, streaming: true, status: "error",
            errorMessage: err instanceof Error ? err.message : String(err),
          })
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
        "X-Summoned-Provider": servedByProvider,
        "X-Summoned-Served-By": servedByAlias,
      },
    })
  })
})
