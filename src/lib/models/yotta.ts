import type { ModelDefinition } from "./types"

export const YOTTA_MODELS: ModelDefinition[] = [
  {
    id: "yotta-mini",
    name: "Yotta Mini",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    contextWindow: 8_192,
    capabilities: ["streaming"],
    description: "Indian GPU cloud — data sovereignty for Indian enterprises",
  },
]
