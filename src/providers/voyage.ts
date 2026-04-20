import { createOpenAICompatProvider } from "./openai-compat"

// Voyage AI — specialized embedding + reranking models (voyage-3-large, voyage-code-3).
// Chat completions are not offered; callers should use /v1/embeddings only.
export function createVoyageProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "voyage",
    name: "Voyage AI",
    apiKey,
    baseURL: "https://api.voyageai.com/v1",
  })
}
