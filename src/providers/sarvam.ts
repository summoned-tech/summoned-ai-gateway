import { createOpenAICompatProvider } from "./openai-compat"

export function createSarvamProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "sarvam",
    name: "Sarvam AI",
    apiKey,
    baseURL: "https://api.sarvam.ai/v1",
  })
}
