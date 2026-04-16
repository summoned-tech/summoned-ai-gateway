import type { ModelDefinition } from "./types"

export const FIREWORKS_MODELS: ModelDefinition[] = [
  {
    id: "accounts/fireworks/models/llama-v3p1-70b-instruct",
    name: "Llama 3.1 70B (Fireworks)",
    inputPricePer1M: 0.90,
    outputPricePer1M: 0.90,
    contextWindow: 131_072,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "accounts/fireworks/models/llama-v3p1-8b-instruct",
    name: "Llama 3.1 8B (Fireworks)",
    inputPricePer1M: 0.20,
    outputPricePer1M: 0.20,
    contextWindow: 131_072,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "accounts/fireworks/models/deepseek-v3",
    name: "DeepSeek V3 (Fireworks)",
    inputPricePer1M: 0.90,
    outputPricePer1M: 0.90,
    contextWindow: 65_536,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "accounts/fireworks/models/mixtral-8x22b-instruct",
    name: "Mixtral 8x22B (Fireworks)",
    inputPricePer1M: 1.20,
    outputPricePer1M: 1.20,
    contextWindow: 65_536,
    capabilities: ["streaming"],
  },
  {
    id: "accounts/fireworks/models/qwen2p5-72b-instruct",
    name: "Qwen 2.5 72B (Fireworks)",
    inputPricePer1M: 0.90,
    outputPricePer1M: 0.90,
    contextWindow: 32_768,
    capabilities: ["streaming", "tools"],
  },
]
