import { createOpenAICompatProvider } from "./openai-compat"

export function createOllamaProvider(baseUrl: string) {
  return createOpenAICompatProvider({
    id: "ollama",
    name: "Ollama (Local)",
    apiKey: "ollama",
    baseURL: `${baseUrl.replace(/\/$/, "")}/v1`,
  })
}
