import { createOpenAICompatProvider } from "./openai-compat"

export function createCerebrasProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "cerebras",
    name: "Cerebras",
    apiKey,
    baseURL: "https://api.cerebras.ai/v1",
  })
}
