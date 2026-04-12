import type { LanguageModel, EmbeddingModel } from "ai"

/**
 * Provider adapter — thin routing wrapper.
 *
 * Design principle: the gateway does NOT validate model IDs.
 * It passes them straight through to the provider API.
 * The upstream provider decides if the model exists.
 *
 * Adding a new provider = one file implementing this interface.
 */
export interface ProviderAdapter {
  readonly id: string
  readonly name: string

  /** Wrap a model ID for the AI SDK. No validation — provider API validates. */
  getModel(modelId: string): LanguageModel

  /** Wrap an embedding model ID. Optional — not all providers do embeddings. */
  getEmbeddingModel?(modelId: string): EmbeddingModel
}

/** Parse "provider/model" -> { provider, model }. Bare "model" has no provider. */
export function parseModelSlug(slug: string): { provider?: string; model: string } {
  const i = slug.indexOf("/")
  return i > 0 ? { provider: slug.slice(0, i), model: slug.slice(i + 1) } : { model: slug }
}
