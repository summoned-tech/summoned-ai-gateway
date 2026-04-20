import { createOpenAICompatProvider } from "./openai-compat"

// HuggingFace Inference Router — OpenAI-compat front-end over HF's inference
// providers marketplace (Together, Novita, Fireworks, HF-hosted, etc.).
export function createHuggingFaceProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "huggingface",
    name: "HuggingFace",
    apiKey,
    baseURL: "https://router.huggingface.co/v1",
  })
}
