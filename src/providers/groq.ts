import { createOpenAICompatProvider } from "./openai-compat"

export function createGroqProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "groq",
    name: "Groq",
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  })
}
