import { createOpenAICompatProvider } from "./openai-compat"

export function createPerplexityProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "perplexity",
    name: "Perplexity AI",
    apiKey,
    baseURL: "https://api.perplexity.ai",
  })
}
