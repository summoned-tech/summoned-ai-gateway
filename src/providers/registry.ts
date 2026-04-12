import type { LanguageModel, EmbeddingModel } from "ai"
import type { ProviderAdapter } from "./base"
import { parseModelSlug } from "./base"
import { logger } from "@/lib/telemetry"

/**
 * Provider registry — the routing brain of the gateway.
 *
 * Model resolution strategy (in order):
 *   1. "openai/gpt-4o"  → explicit provider prefix — always wins
 *   2. "gpt-4o"         → try default provider (if set), else first registered
 *
 * No static model-to-provider alias maps. Users use "provider/model" format
 * for clarity. The gateway is a router, not a catalog.
 */
class ProviderRegistry {
  private providers = new Map<string, ProviderAdapter>()
  private defaultProviderId: string | null = null

  register(provider: ProviderAdapter): void {
    this.providers.set(provider.id, provider)
    if (!this.defaultProviderId) this.defaultProviderId = provider.id
    logger.info({ providerId: provider.id, name: provider.name }, "provider registered")
  }

  setDefault(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`Cannot set default: provider "${providerId}" not registered`)
    }
    this.defaultProviderId = providerId
  }

  get(id: string): ProviderAdapter | undefined {
    return this.providers.get(id)
  }

  all(): ProviderAdapter[] {
    return [...this.providers.values()]
  }

  allIds(): string[] {
    return [...this.providers.keys()]
  }

  /**
   * Resolve a model slug to a provider + model ID.
   *
   * "openai/gpt-4o"  → provider=openai,  model=gpt-4o
   * "gpt-4o"         → provider=default,  model=gpt-4o
   */
  resolve(slug: string): { provider: ProviderAdapter; modelId: string } {
    const { provider: hint, model } = parseModelSlug(slug)

    if (hint) {
      const adapter = this.providers.get(hint)
      if (!adapter) {
        throw new Error(
          `Provider "${hint}" not found. Available: [${this.allIds().join(", ")}]. ` +
          `Use "provider/model" format, e.g. "openai/gpt-4o".`
        )
      }
      return { provider: adapter, modelId: model }
    }

    // No prefix — use default provider
    if (this.defaultProviderId) {
      const adapter = this.providers.get(this.defaultProviderId)!
      return { provider: adapter, modelId: model }
    }

    if (this.providers.size === 1) {
      const adapter = this.providers.values().next().value!
      return { provider: adapter, modelId: model }
    }

    throw new Error(
      `Ambiguous model "${slug}" — multiple providers registered. ` +
      `Use "provider/model" format. Available: [${this.allIds().join(", ")}]`
    )
  }

  getModel(slug: string): { model: LanguageModel; provider: ProviderAdapter; modelId: string } {
    const { provider, modelId } = this.resolve(slug)
    return { model: provider.getModel(modelId), provider, modelId }
  }

  getEmbeddingModel(slug: string): { model: EmbeddingModel; provider: ProviderAdapter; modelId: string } {
    const { provider, modelId } = this.resolve(slug)
    if (!provider.getEmbeddingModel) {
      throw new Error(`Provider "${provider.id}" does not support embeddings`)
    }
    return { model: provider.getEmbeddingModel(modelId), provider, modelId }
  }
}

export const registry = new ProviderRegistry()
