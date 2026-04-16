import { createOpenAICompatProvider } from "./openai-compat"

export function createXAIProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "xai",
    name: "xAI (Grok)",
    apiKey,
    baseURL: "https://api.x.ai/v1",
  })
}
