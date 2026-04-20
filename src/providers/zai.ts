import { createOpenAICompatProvider } from "./openai-compat"

// Z.AI (Zhipu) — GLM family models (GLM-4.5, GLM-4-plus) with OpenAI-compat surface.
export function createZAIProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "zai",
    name: "Z.AI",
    apiKey,
    baseURL: "https://api.z.ai/api/paas/v4",
  })
}
