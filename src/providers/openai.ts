import { createOpenAICompatProvider } from "./openai-compat"

export function createOpenAIProvider(apiKey: string) {
  return createOpenAICompatProvider({ id: "openai", name: "OpenAI", apiKey })
}
