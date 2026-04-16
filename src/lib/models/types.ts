/**
 * A single model's definition: pricing + metadata.
 *
 * Every provider file exports an array of ModelDefinition[].
 * The models/index.ts aggregates them all into a single registry.
 *
 * Missing inputPricePer1M / outputPricePer1M → 0 (gateway still works,
 * cost tracking just reports $0 for that model).
 */

export type ModelCapability =
  | "streaming"   // supports SSE streaming
  | "tools"       // function/tool calling
  | "vision"      // image input
  | "json_mode"   // structured JSON output
  | "embeddings"  // text embeddings
  | "search"      // web search augmented (e.g. Perplexity)
  | "reasoning"   // chain-of-thought reasoning models (o1, deepseek-reasoner)

export interface ModelDefinition {
  /** API model ID exactly as passed in the request, e.g. "gpt-4o" */
  id: string
  /** Human-readable display name */
  name: string
  /** USD per 1 million input tokens (0 = not tracked / free tier) */
  inputPricePer1M: number
  /** USD per 1 million output tokens */
  outputPricePer1M: number
  /** Maximum context window in tokens */
  contextWindow?: number
  /** Supported capabilities for this model */
  capabilities?: ModelCapability[]
  /** True if this model is deprecated / being phased out */
  deprecated?: boolean
  /** Optional short description shown in /v1/models */
  description?: string
}
