import type { ModelDefinition } from "./types"

/**
 * Ollama runs models locally — no per-token cost.
 * We list common models for display purposes only; any model
 * installed in the local Ollama instance will work.
 */
export const OLLAMA_MODELS: ModelDefinition[] = [
  {
    id: "llama3.2",
    name: "Llama 3.2 (local)",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools"],
    description: "Run locally via Ollama — zero cost, full data privacy",
  },
  {
    id: "llama3.1",
    name: "Llama 3.1 (local)",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "mistral",
    name: "Mistral 7B (local)",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    contextWindow: 32_768,
    capabilities: ["streaming"],
  },
  {
    id: "qwen2.5",
    name: "Qwen 2.5 (local)",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1 (local)",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    contextWindow: 65_536,
    capabilities: ["streaming", "reasoning"],
  },
]
