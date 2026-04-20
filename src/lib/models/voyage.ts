import type { ModelDefinition } from "./types"

// Voyage models are embedding-only. inputPricePer1M applies to tokens embedded;
// outputPricePer1M is 0.
export const VOYAGE_MODELS: ModelDefinition[] = [
  {
    id: "voyage-3-large",
    name: "Voyage 3 Large",
    inputPricePer1M: 0.18,
    outputPricePer1M: 0,
    contextWindow: 32_000,
    capabilities: ["embeddings"],
  },
  {
    id: "voyage-3",
    name: "Voyage 3",
    inputPricePer1M: 0.06,
    outputPricePer1M: 0,
    contextWindow: 32_000,
    capabilities: ["embeddings"],
  },
  {
    id: "voyage-code-3",
    name: "Voyage Code 3",
    inputPricePer1M: 0.18,
    outputPricePer1M: 0,
    contextWindow: 32_000,
    capabilities: ["embeddings"],
  },
]
