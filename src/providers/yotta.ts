import { createOpenAICompatProvider } from "./openai-compat"

export function createYottaProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "yotta",
    name: "Yotta Labs",
    apiKey,
    baseURL: "https://api.yotta.ai/v1",
  })
}
