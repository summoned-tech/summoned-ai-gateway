import { createGoogleGenerativeAI } from "@ai-sdk/google"
import type { LanguageModel, EmbeddingModel } from "ai"
import type { ProviderAdapter } from "./base"

export function createGoogleProvider(apiKey: string): ProviderAdapter {
  const sdk = createGoogleGenerativeAI({ apiKey })

  return {
    id: "google",
    name: "Google Gemini",
    getModel(modelId: string): LanguageModel {
      return sdk(modelId)
    },
    getEmbeddingModel(modelId: string): EmbeddingModel {
      return sdk.textEmbeddingModel(modelId)
    },
  }
}
