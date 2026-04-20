import { createOpenAICompatProvider } from "./openai-compat"

// vLLM — generic self-hosted OpenAI-compat inference server.
// Like Ollama, the baseURL is operator-configurable and the API key may be empty.
export function createVLLMProvider(baseURL: string, apiKey = "") {
  return createOpenAICompatProvider({
    id: "vllm",
    name: "vLLM",
    apiKey: apiKey || "EMPTY",
    baseURL,
  })
}
