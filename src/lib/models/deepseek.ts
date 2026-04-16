import type { ModelDefinition } from "./types"

export const DEEPSEEK_MODELS: ModelDefinition[] = [
  {
    id: "deepseek-chat",
    name: "DeepSeek V3",
    inputPricePer1M: 0.27,
    outputPricePer1M: 1.10,
    contextWindow: 65_536,
    capabilities: ["streaming", "tools", "json_mode"],
    description: "Frontier model at a fraction of GPT-4 cost",
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek R1",
    inputPricePer1M: 0.55,
    outputPricePer1M: 2.19,
    contextWindow: 65_536,
    capabilities: ["streaming", "reasoning"],
    description: "Chain-of-thought reasoning model, comparable to o1",
  },
]
