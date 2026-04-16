import { createOpenAICompatProvider } from "./openai-compat"

export function createFireworksProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "fireworks",
    name: "Fireworks AI",
    apiKey,
    baseURL: "https://api.fireworks.ai/inference/v1",
  })
}
