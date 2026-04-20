import type { ModelDefinition } from "./types"

export const SAMBANOVA_MODELS: ModelDefinition[] = [
  {
    id: "Meta-Llama-3.1-405B-Instruct",
    name: "Llama 3.1 405B (SambaNova)",
    inputPricePer1M: 5.0,
    outputPricePer1M: 10.0,
    contextWindow: 8_192,
    capabilities: ["streaming"],
  },
  {
    id: "Meta-Llama-3.1-70B-Instruct",
    name: "Llama 3.1 70B (SambaNova)",
    inputPricePer1M: 0.60,
    outputPricePer1M: 1.20,
    contextWindow: 8_192,
    capabilities: ["streaming"],
  },
]
