import { createOpenAICompatProvider } from "./openai-compat"

// Novita AI — low-cost inference for Llama, DeepSeek, and image/video models.
export function createNovitaProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "novita",
    name: "Novita AI",
    apiKey,
    baseURL: "https://api.novita.ai/v3/openai",
  })
}
