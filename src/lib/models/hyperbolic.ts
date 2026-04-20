import type { ModelDefinition } from "./types"

export const HYPERBOLIC_MODELS: ModelDefinition[] = [
  {
    id: "meta-llama/Meta-Llama-3.1-70B-Instruct",
    name: "Llama 3.1 70B (Hyperbolic)",
    inputPricePer1M: 0.40,
    outputPricePer1M: 0.40,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "deepseek-ai/DeepSeek-V3",
    name: "DeepSeek V3 (Hyperbolic)",
    inputPricePer1M: 0.25,
    outputPricePer1M: 0.25,
    contextWindow: 131_072,
    capabilities: ["streaming"],
  },
]
