import type { ModelDefinition } from "./types"

export const MISTRAL_MODELS: ModelDefinition[] = [
  {
    id: "mistral-large-latest",
    name: "Mistral Large",
    inputPricePer1M: 2.00,
    outputPricePer1M: 6.00,
    contextWindow: 131_072,
    capabilities: ["streaming", "tools", "json_mode"],
  },
  {
    id: "mistral-small-latest",
    name: "Mistral Small",
    inputPricePer1M: 0.20,
    outputPricePer1M: 0.60,
    contextWindow: 131_072,
    capabilities: ["streaming", "tools", "json_mode"],
  },
  {
    id: "codestral-latest",
    name: "Codestral",
    inputPricePer1M: 0.30,
    outputPricePer1M: 0.90,
    contextWindow: 262_144,
    capabilities: ["streaming"],
    description: "Optimised for code generation and completion",
  },
  {
    id: "open-mistral-7b",
    name: "Mistral 7B",
    inputPricePer1M: 0.25,
    outputPricePer1M: 0.25,
    contextWindow: 32_768,
    capabilities: ["streaming"],
  },
  {
    id: "open-mixtral-8x22b",
    name: "Mixtral 8x22B",
    inputPricePer1M: 2.00,
    outputPricePer1M: 6.00,
    contextWindow: 65_536,
    capabilities: ["streaming", "tools"],
  },
]
