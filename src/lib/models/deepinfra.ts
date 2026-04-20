import type { ModelDefinition } from "./types"

// Prices are representative for DeepInfra hosted open-source models as of 2026-04.
// Unknown models fall through with priceUnknown=true.
export const DEEPINFRA_MODELS: ModelDefinition[] = [
  {
    id: "meta-llama/Meta-Llama-3.1-70B-Instruct",
    name: "Llama 3.1 70B (DeepInfra)",
    inputPricePer1M: 0.35,
    outputPricePer1M: 0.40,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "meta-llama/Meta-Llama-3.1-405B-Instruct",
    name: "Llama 3.1 405B (DeepInfra)",
    inputPricePer1M: 0.80,
    outputPricePer1M: 0.80,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "Qwen/Qwen2.5-72B-Instruct",
    name: "Qwen 2.5 72B (DeepInfra)",
    inputPricePer1M: 0.35,
    outputPricePer1M: 0.40,
    contextWindow: 131_072,
    capabilities: ["streaming"],
  },
]
