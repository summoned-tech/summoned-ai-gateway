/**
 * Central model registry.
 *
 * Every provider file exports a ModelDefinition[].
 * This file registers them all into a single Map keyed by "provider:modelId".
 *
 * Adding a new provider = create a new file + add one register() call here.
 */

import { env } from "@/lib/env"
import type { ModelDefinition } from "./types"

import { OPENAI_MODELS } from "./openai"
import { ANTHROPIC_MODELS } from "./anthropic"
import { GOOGLE_MODELS } from "./google"
import { GROQ_MODELS } from "./groq"
import { BEDROCK_MODELS } from "./bedrock"
import { AZURE_OPENAI_MODELS } from "./azure-openai"
import { OLLAMA_MODELS } from "./ollama"
import { SARVAM_MODELS } from "./sarvam"
import { YOTTA_MODELS } from "./yotta"
import { MISTRAL_MODELS } from "./mistral"
import { TOGETHER_MODELS } from "./together"
import { DEEPSEEK_MODELS } from "./deepseek"
import { FIREWORKS_MODELS } from "./fireworks"
import { COHERE_MODELS } from "./cohere"
import { CEREBRAS_MODELS } from "./cerebras"
import { PERPLEXITY_MODELS } from "./perplexity"
import { XAI_MODELS } from "./xai"
import { DEEPINFRA_MODELS } from "./deepinfra"
import { HYPERBOLIC_MODELS } from "./hyperbolic"
import { SAMBANOVA_MODELS } from "./sambanova"
import { NOVITA_MODELS } from "./novita"
import { MOONSHOT_MODELS } from "./moonshot"
import { ZAI_MODELS } from "./zai"
import { NVIDIA_MODELS } from "./nvidia"
import { VOYAGE_MODELS } from "./voyage"

export type { ModelDefinition } from "./types"
export type { ModelCapability } from "./types"

// ---------------------------------------------------------------------------
// Internal registry
// ---------------------------------------------------------------------------

const registry = new Map<string, ModelDefinition>()

function register(providerId: string, models: ModelDefinition[]): void {
  for (const m of models) {
    registry.set(`${providerId}:${m.id}`, m)
  }
}

register("openai",      OPENAI_MODELS)
register("anthropic",   ANTHROPIC_MODELS)
register("google",      GOOGLE_MODELS)
register("groq",        GROQ_MODELS)
register("bedrock",     BEDROCK_MODELS)
register("azure",       AZURE_OPENAI_MODELS)
register("ollama",      OLLAMA_MODELS)
register("sarvam",      SARVAM_MODELS)
register("yotta",       YOTTA_MODELS)
register("mistral",     MISTRAL_MODELS)
register("together",    TOGETHER_MODELS)
register("deepseek",    DEEPSEEK_MODELS)
register("fireworks",   FIREWORKS_MODELS)
register("cohere",      COHERE_MODELS)
register("cerebras",    CEREBRAS_MODELS)
register("perplexity",  PERPLEXITY_MODELS)
register("xai",         XAI_MODELS)
register("deepinfra",   DEEPINFRA_MODELS)
register("hyperbolic",  HYPERBOLIC_MODELS)
register("sambanova",   SAMBANOVA_MODELS)
register("novita",      NOVITA_MODELS)
register("moonshot",    MOONSHOT_MODELS)
register("zai",         ZAI_MODELS)
register("nvidia",      NVIDIA_MODELS)
register("voyage",      VOYAGE_MODELS)

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Look up a model definition by provider ID + model ID. */
export function getModel(providerId: string, modelId: string): ModelDefinition | undefined {
  return registry.get(`${providerId}:${modelId}`)
}

/** List all known models, optionally filtered by provider. */
export function listModels(providerId?: string): ModelDefinition[] {
  if (!providerId) return [...registry.values()]
  return [...registry.entries()]
    .filter(([key]) => key.startsWith(`${providerId}:`))
    .map(([, m]) => m)
}

/**
 * Return input cost per 1M tokens for a "provider/model" alias.
 * Used for cost-based routing.
 *
 * Unknown models return 0 (not Infinity) so they are treated as "potentially
 * cheapest" and still included in the routing order rather than excluded.
 * The caller should handle unknown cost explicitly if needed.
 */
export function getInputCostPer1M(alias: string): number {
  const slash = alias.indexOf("/")
  if (slash === -1) return 0
  const providerId = alias.slice(0, slash)
  const modelId = alias.slice(slash + 1)
  return registry.get(`${providerId}:${modelId}`)?.inputPricePer1M ?? 0
}

// ---------------------------------------------------------------------------
// Cost calculation
// ---------------------------------------------------------------------------

export interface CostResult {
  costUsd: number
  costInr: number
  inputCostUsd: number
  outputCostUsd: number
  /** True when the model is not in our pricing catalog — cost figures are $0 and unreliable. */
  priceUnknown: boolean
}

export function calculateCost(
  providerId: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): CostResult {
  const model = registry.get(`${providerId}:${modelId}`)

  // Model not in catalog — request still works, cost is genuinely unknown (not free).
  if (!model) {
    return { costUsd: 0, costInr: 0, inputCostUsd: 0, outputCostUsd: 0, priceUnknown: true }
  }

  // Model in catalog but pricing not set (e.g. Ollama, free-tier models).
  if (!model.inputPricePer1M && !model.outputPricePer1M) {
    return { costUsd: 0, costInr: 0, inputCostUsd: 0, outputCostUsd: 0, priceUnknown: false }
  }

  const inputCostUsd  = (inputTokens  / 1_000_000) * model.inputPricePer1M
  const outputCostUsd = (outputTokens / 1_000_000) * model.outputPricePer1M
  const costUsd       = inputCostUsd + outputCostUsd
  const costInr       = costUsd * env.USD_INR_RATE

  return { costUsd, costInr, inputCostUsd, outputCostUsd, priceUnknown: false }
}
