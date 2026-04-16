import type { ModelDefinition } from "./types"

export const SARVAM_MODELS: ModelDefinition[] = [
  {
    id: "sarvam-2b-v0.5",
    name: "Sarvam 2B",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    contextWindow: 4_096,
    capabilities: ["streaming"],
    description: "India-first multilingual model supporting 10 Indian languages",
  },
  {
    id: "sarvam-m",
    name: "Sarvam M",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    contextWindow: 32_768,
    capabilities: ["streaming", "tools"],
    description: "Medium-scale model optimised for Indic languages and code",
  },
]
