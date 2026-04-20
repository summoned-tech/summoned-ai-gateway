import { createOpenAICompatProvider } from "./openai-compat"

// Hyperbolic — GPU inference specializing in large open-source models.
export function createHyperbolicProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "hyperbolic",
    name: "Hyperbolic",
    apiKey,
    baseURL: "https://api.hyperbolic.xyz/v1",
  })
}
