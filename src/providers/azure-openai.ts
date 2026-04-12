import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel, EmbeddingModel } from "ai"
import type { ProviderAdapter } from "./base"

export function createAzureOpenAIProvider(apiKey: string, endpoint: string): ProviderAdapter {
  const sdk = createOpenAI({
    apiKey,
    baseURL: `${endpoint.replace(/\/$/, "")}/openai/deployments`,
    headers: { "api-key": apiKey },
  })

  return {
    id: "azure",
    name: "Azure OpenAI",
    getModel(modelId: string): LanguageModel {
      return sdk(modelId)
    },
    getEmbeddingModel(modelId: string): EmbeddingModel {
      return sdk.textEmbeddingModel(modelId)
    },
  }
}
