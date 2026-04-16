import type { LanguageModel, EmbeddingModel } from "ai"
import { BedrockClient, ListFoundationModelsCommand, type FoundationModelSummary } from "@aws-sdk/client-bedrock"
import type { ProviderAdapter } from "./base"
import { env } from "@/lib/env"
import { logger } from "@/lib/telemetry"

// ---------------------------------------------------------------------------
// Model cache — fetched lazily from Bedrock API (not a static catalog)
// ---------------------------------------------------------------------------

let _availableModels: FoundationModelSummary[] = []
let _lastFetched = 0
const CACHE_TTL_MS = 60 * 60 * 1000

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
    byOutputModality: "TEXT",
    byInferenceType: "ON_DEMAND",
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
    if (_availableModels.length > 0) {
      logger.warn({ err }, "failed to refresh bedrock model list, using stale cache")
    } else {
      logger.error({ err }, "failed to fetch bedrock model list on startup")
      throw err
    }
  }
}

/** Returns models fetched from the Bedrock API (dynamic, not a static list) */
export function listAvailableModels() {
  return _availableModels.map((m) => ({
    id: m.modelId ?? "",
    object: "model" as const,
    created: 1_700_000_000,
    owned_by: m.providerName?.toLowerCase() ?? "unknown",
  }))
}

// ---------------------------------------------------------------------------
// Demo mode — pins all requests to a fixed model for testing
// ---------------------------------------------------------------------------

const DEMO_MODEL_ID = "amazon.nova-pro-v1:0"

function resolveModelId(modelId: string): string {
  if (env.BEDROCK_DEMO_MODE) return DEMO_MODEL_ID
  return modelId
}

// ---------------------------------------------------------------------------
// AI SDK Bedrock provider — lazy init singleton
// ---------------------------------------------------------------------------

let _provider: Awaited<ReturnType<typeof import("@ai-sdk/amazon-bedrock").createAmazonBedrock>> | null = null

async function getAiSdkProvider() {
  if (_provider) return _provider

  const { createAmazonBedrock } = await import("@ai-sdk/amazon-bedrock")
  const opts: Record<string, unknown> = { region: env.AWS_REGION }

  if (env.AWS_BEDROCK_API_KEY) {
    opts.apiKey = env.AWS_BEDROCK_API_KEY
  } else if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    opts.accessKeyId = env.AWS_ACCESS_KEY_ID
    opts.secretAccessKey = env.AWS_SECRET_ACCESS_KEY
  }

  // Zod v4 + AI SDK produces broken JSON schemas for tools — intercept and fix
  opts.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    let bodyStr: string | null = null
    if (typeof init?.body === "string") bodyStr = init.body
    else if (init?.body instanceof Uint8Array) bodyStr = new TextDecoder().decode(init.body)
    if (bodyStr) {
      try {
        const body = JSON.parse(bodyStr)
        if (body.toolConfig?.tools) {
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

export const _toolSchemaCache = new Map<string, Record<string, unknown>>()

// ---------------------------------------------------------------------------
// ProviderAdapter implementation
// ---------------------------------------------------------------------------

let _bedrockAdapter: ProviderAdapter | null = null

export async function createBedrockProvider(): Promise<ProviderAdapter> {
  if (_bedrockAdapter) return _bedrockAdapter

  const aiProvider = await getAiSdkProvider()

  _bedrockAdapter = {
    id: "bedrock",
    name: "AWS Bedrock",

    getModel(modelId: string): LanguageModel {
      return aiProvider(resolveModelId(modelId))
    },

    getEmbeddingModel(modelId: string): EmbeddingModel {
      return aiProvider.textEmbeddingModel(modelId)
    },
  }

  return _bedrockAdapter
}

// ---------------------------------------------------------------------------
// BYOK factory — creates a per-request, non-singleton adapter using a caller-
// supplied AWS Bedrock bearer token (AWS_BEARER_TOKEN_BEDROCK-style key).
//
// x-provider-key header format accepted by the gateway:
//   "[region|]bearer-token"
//   "us-east-1|your-bedrock-api-key"  → region=us-east-1
//   "your-bedrock-api-key"            → falls back to env.AWS_REGION
// ---------------------------------------------------------------------------

export async function createBedrockByokProvider(
  bearerToken: string,
  region?: string,
): Promise<ProviderAdapter> {
  const { createAmazonBedrock } = await import("@ai-sdk/amazon-bedrock")

  const resolvedRegion = region ?? env.AWS_REGION

  // Use Record<string, unknown> to sidestep the FetchFunction.preconnect type
  // constraint — same pattern as the singleton getAiSdkProvider above.
  const opts: Record<string, unknown> = {
    region: resolvedRegion,
    apiKey: bearerToken,
  }

  // Zod v4 + AI SDK produces broken JSON schemas for tools — intercept and fix
  opts.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    let bodyStr: string | null = null
    if (typeof init?.body === "string") bodyStr = init.body
    else if (init?.body instanceof Uint8Array) bodyStr = new TextDecoder().decode(init.body)
    if (bodyStr) {
      try {
        const body = JSON.parse(bodyStr)
        if (body.toolConfig?.tools) {
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

  const aiProvider = createAmazonBedrock(opts)

  logger.debug(
    { region: resolvedRegion, authMethod: "bearer-token-byok" },
    "ephemeral bedrock provider created for BYOK request",
  )

  return {
    id: "bedrock",
    name: "AWS Bedrock",
    getModel(modelId: string): LanguageModel {
      return aiProvider(resolveModelId(modelId))
    },
    getEmbeddingModel(modelId: string): EmbeddingModel {
      return aiProvider.textEmbeddingModel(modelId)
    },
  }
}

// Backward compat
export async function getBedrockProvider() { return getAiSdkProvider() }
export function resolveBedrockModelId(alias: string): string { return resolveModelId(alias) }
