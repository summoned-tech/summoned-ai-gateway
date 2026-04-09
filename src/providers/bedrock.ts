import type { LanguageModel } from "ai"
import { BedrockClient, ListFoundationModelsCommand, type FoundationModelSummary } from "@aws-sdk/client-bedrock"
import { env } from "@/lib/env"
import { logger } from "@/lib/telemetry"

// ---------------------------------------------------------------------------
// Available models — fetched from Bedrock at startup, cached in memory.
// No static list to maintain. Whatever AWS has in ap-south-1, we serve.
// ---------------------------------------------------------------------------

let _availableModels: FoundationModelSummary[] = []
let _lastFetched = 0
const CACHE_TTL_MS = 60 * 60 * 1000 // re-fetch every hour in case AWS adds new models

async function fetchAvailableModels(): Promise<FoundationModelSummary[]> {
  const opts: ConstructorParameters<typeof BedrockClient>[0] = { region: env.AWS_REGION }

  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    opts.credentials = {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    }
  }

  const client = new BedrockClient(opts)

  const response = await client.send(new ListFoundationModelsCommand({
    byOutputModality: "TEXT",          // only text-output models — skip image/embedding
    byInferenceType: "ON_DEMAND",      // only serverless (no provisioned throughput needed)
  }))

  return response.modelSummaries ?? []
}

export async function refreshModelCache(): Promise<void> {
  const now = Date.now()
  if (_availableModels.length > 0 && now - _lastFetched < CACHE_TTL_MS) return

  try {
    _availableModels = await fetchAvailableModels()
    _lastFetched = now
    logger.info({ count: _availableModels.length, region: env.AWS_REGION }, "bedrock model list refreshed")
  } catch (err) {
    // On refresh failure, keep using stale cache — don't crash
    if (_availableModels.length > 0) {
      logger.warn({ err }, "failed to refresh bedrock model list, using stale cache")
    } else {
      logger.error({ err }, "failed to fetch bedrock model list on startup")
      throw err
    }
  }
}

// ---------------------------------------------------------------------------
// Demo mode
// ---------------------------------------------------------------------------

const DEMO_MODEL_ID = "amazon.nova-pro-v1:0"

export function resolveBedrockModelId(modelId: string): string {
  if (env.BEDROCK_DEMO_MODE) return DEMO_MODEL_ID
  return modelId
}

// ---------------------------------------------------------------------------
// Provider factory — lazy init, singleton
// ---------------------------------------------------------------------------

let _provider: Awaited<ReturnType<typeof import("@ai-sdk/amazon-bedrock").createAmazonBedrock>> | null = null

export async function getBedrockProvider() {
  if (_provider) return _provider

  const { createAmazonBedrock } = await import("@ai-sdk/amazon-bedrock")

  const opts: Record<string, unknown> = { region: env.AWS_REGION }

  if (env.AWS_BEDROCK_API_KEY) {
    opts.apiKey = env.AWS_BEDROCK_API_KEY
  } else if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    opts.accessKeyId = env.AWS_ACCESS_KEY_ID
    opts.secretAccessKey = env.AWS_SECRET_ACCESS_KEY
  }

  // Zod v4 + AI SDK's asSchema() produces broken JSON schemas for tools
  // (missing type/properties). We intercept the fetch and replace tool schemas
  // with the original clean JSON schemas cached by openAiToolsToTools().
  opts.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    let bodyStr: string | null = null
    if (typeof init?.body === "string") bodyStr = init.body
    else if (init?.body instanceof Uint8Array) bodyStr = new TextDecoder().decode(init.body)
    if (bodyStr) {
      try {
        const body = JSON.parse(bodyStr)
        if (body.toolConfig?.tools) {
          const { _toolSchemaCache } = await import("@/routers/completions")
          for (const tool of body.toolConfig.tools) {
            if (tool.toolSpec) {
              const cached = _toolSchemaCache.get(tool.toolSpec.name)
              if (cached) {
                tool.toolSpec.inputSchema = { json: cached }
              }
            }
          }
          init = { ...init, body: JSON.stringify(body) }
        }
      } catch { /* not JSON, pass through */ }
    }
    return globalThis.fetch(url, init!)
  }

  _provider = createAmazonBedrock(opts)

  logger.info({
    region: env.AWS_REGION,
    demoMode: env.BEDROCK_DEMO_MODE,
    authMethod: env.AWS_BEDROCK_API_KEY ? "api-key" : "iam",
  }, "bedrock provider initialized")

  return _provider
}

export async function getBedrockModel(modelAlias: string): Promise<LanguageModel> {
  const provider = await getBedrockProvider()
  const modelId = resolveBedrockModelId(modelAlias)
  return provider(modelId)
}

// ---------------------------------------------------------------------------
// /v1/models — returns live list from Bedrock, OpenAI-compatible format
// ---------------------------------------------------------------------------

export function listAvailableModels() {
  return _availableModels.map((m) => ({
    id: m.modelId ?? "",
    object: "model" as const,
    created: 1_700_000_000,
    owned_by: m.providerName?.toLowerCase() ?? "unknown",
    summoned: {
      model_name: m.modelName,
      provider: m.providerName,
      input_modalities: m.inputModalities,
      output_modalities: m.outputModalities,
      streaming: m.responseStreamingSupported ?? false,
    },
  }))
}
