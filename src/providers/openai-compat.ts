import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel, EmbeddingModel } from "ai"
import type { ProviderAdapter } from "./base"

/**
 * Factory for any OpenAI-compatible provider.
 * Works for: OpenAI, Groq, Ollama, Yotta, Sarvam, and any
 * future provider that speaks the OpenAI API format.
 *
 * Adding a new OpenAI-compatible provider = one function call.
 */
export function createOpenAICompatProvider(opts: {
  id: string
  name: string
  apiKey: string
  baseURL?: string
  headers?: Record<string, string>
}): ProviderAdapter {
  const sdk = createOpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL,
    headers: opts.headers,
  })

  return {
    id: opts.id,
    name: opts.name,
    getModel(modelId: string): LanguageModel {
      return sdk(modelId)
    },
    getEmbeddingModel(modelId: string): EmbeddingModel {
      return sdk.textEmbeddingModel(modelId)
    },
  }
}
