import type { ModelDefinition } from "./types"

export const MOONSHOT_MODELS: ModelDefinition[] = [
  {
    id: "moonshot-v1-8k",
    name: "Moonshot v1 (8K)",
    inputPricePer1M: 1.65,
    outputPricePer1M: 1.65,
    contextWindow: 8_192,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "moonshot-v1-32k",
    name: "Moonshot v1 (32K)",
    inputPricePer1M: 3.30,
    outputPricePer1M: 3.30,
    contextWindow: 32_768,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "moonshot-v1-128k",
    name: "Moonshot v1 (128K)",
    inputPricePer1M: 8.25,
    outputPricePer1M: 8.25,
    contextWindow: 131_072,
    capabilities: ["streaming", "tools"],
  },
]
