import { createAnthropic } from "@ai-sdk/anthropic"
import type { LanguageModel } from "ai"
import type { ProviderAdapter } from "./base"

export function createAnthropicProvider(apiKey: string): ProviderAdapter {
  const sdk = createAnthropic({ apiKey })

  return {
    id: "anthropic",
    name: "Anthropic",
    getModel(modelId: string): LanguageModel {
      return sdk(modelId)
    },
  }
}
