import type { ModelDefinition } from "./types"

export const SARVAM_MODELS: ModelDefinition[] = [
  {
    id: "sarvam-105b",
    name: "Sarvam 105B",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    contextWindow: 131_072,
    capabilities: ["streaming", "tools"],
    description: "Flagship model — complex reasoning, coding, and 10+ Indian languages",
  },
  {
    id: "sarvam-30b",
    name: "Sarvam 30B",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    contextWindow: 65_536,
    capabilities: ["streaming", "tools"],
    description: "Balanced performance for standard conversations and Q&A in Indic languages",
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
