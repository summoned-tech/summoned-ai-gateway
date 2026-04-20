import type { ModelDefinition } from "./types"

export const ZAI_MODELS: ModelDefinition[] = [
  {
    id: "glm-4.5",
    name: "GLM-4.5",
    inputPricePer1M: 0.60,
    outputPricePer1M: 2.20,
    contextWindow: 131_072,
    capabilities: ["streaming", "tools", "json_mode"],
  },
  {
    id: "glm-4-plus",
    name: "GLM-4 Plus",
    inputPricePer1M: 7.20,
    outputPricePer1M: 7.20,
    contextWindow: 131_072,
    capabilities: ["streaming", "tools"],
  },
]
