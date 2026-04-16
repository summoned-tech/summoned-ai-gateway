import { createOpenAICompatProvider } from "./openai-compat"

export function createCohereProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "cohere",
    name: "Cohere",
    apiKey,
    baseURL: "https://api.cohere.com/compatibility/v1",
  })
}
