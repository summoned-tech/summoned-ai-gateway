import { createOpenAICompatProvider } from "./openai-compat"

// DeepInfra — low-cost hosted inference for open-source models (Llama, Mixtral, Qwen).
export function createDeepInfraProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "deepinfra",
    name: "DeepInfra",
    apiKey,
    baseURL: "https://api.deepinfra.com/v1/openai",
  })
}
