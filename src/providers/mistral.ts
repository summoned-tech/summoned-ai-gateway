import { createOpenAICompatProvider } from "./openai-compat"

export function createMistralProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "mistral",
    name: "Mistral AI",
    apiKey,
    baseURL: "https://api.mistral.ai/v1",
  })
}
