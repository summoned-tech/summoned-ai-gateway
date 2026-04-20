import type { ModelDefinition } from "./types"

export const NOVITA_MODELS: ModelDefinition[] = [
  {
    id: "meta-llama/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B (Novita)",
    inputPricePer1M: 0.34,
    outputPricePer1M: 0.39,
    contextWindow: 131_072,
    capabilities: ["streaming"],
  },
  {
    id: "deepseek/deepseek-v3",
    name: "DeepSeek V3 (Novita)",
    inputPricePer1M: 0.28,
    outputPricePer1M: 0.89,
    contextWindow: 65_536,
    capabilities: ["streaming"],
  },
]
