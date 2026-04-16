import { createOpenAICompatProvider } from "./openai-compat"

export function createTogetherProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "together",
    name: "Together AI",
    apiKey,
    baseURL: "https://api.together.xyz/v1",
  })
}
