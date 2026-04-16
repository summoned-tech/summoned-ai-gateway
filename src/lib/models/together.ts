import type { ModelDefinition } from "./types"

export const TOGETHER_MODELS: ModelDefinition[] = [
  {
    id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    name: "Llama 3.3 70B Turbo",
    inputPricePer1M: 0.88,
    outputPricePer1M: 0.88,
    contextWindow: 131_072,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    name: "Llama 3.1 8B Turbo",
    inputPricePer1M: 0.18,
    outputPricePer1M: 0.18,
    contextWindow: 131_072,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
    name: "Llama 3.1 405B Turbo",
    inputPricePer1M: 5.00,
    outputPricePer1M: 5.00,
    contextWindow: 131_072,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "Qwen/Qwen2.5-72B-Instruct-Turbo",
    name: "Qwen 2.5 72B Turbo",
    inputPricePer1M: 1.20,
    outputPricePer1M: 1.20,
    contextWindow: 32_768,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "deepseek-ai/DeepSeek-V3",
    name: "DeepSeek V3 (Together)",
    inputPricePer1M: 1.25,
    outputPricePer1M: 1.25,
    contextWindow: 65_536,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "mistralai/Mixtral-8x7B-Instruct-v0.1",
    name: "Mixtral 8x7B (Together)",
    inputPricePer1M: 0.60,
    outputPricePer1M: 0.60,
    contextWindow: 32_768,
    capabilities: ["streaming"],
  },
]
