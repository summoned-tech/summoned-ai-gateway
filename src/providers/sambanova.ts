import { createOpenAICompatProvider } from "./openai-compat"

// SambaNova — RDU-accelerated inference for Llama and Qwen families.
export function createSambaNovaProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "sambanova",
    name: "SambaNova",
    apiKey,
    baseURL: "https://api.sambanova.ai/v1",
  })
}
