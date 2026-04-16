import { createOpenAICompatProvider } from "./openai-compat"

export function createDeepSeekProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "deepseek",
    name: "DeepSeek",
    apiKey,
    baseURL: "https://api.deepseek.com/v1",
  })
}
