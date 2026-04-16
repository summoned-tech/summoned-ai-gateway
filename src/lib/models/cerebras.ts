import type { ModelDefinition } from "./types"

export const CEREBRAS_MODELS: ModelDefinition[] = [
  {
    id: "llama3.1-70b",
    name: "Llama 3.1 70B (Cerebras)",
    inputPricePer1M: 0.60,
    outputPricePer1M: 0.60,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools"],
    description: "2,000+ tokens/sec on Cerebras wafer-scale chips",
  },
  {
    id: "llama3.1-8b",
    name: "Llama 3.1 8B (Cerebras)",
    inputPricePer1M: 0.10,
    outputPricePer1M: 0.10,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools"],
    description: "Ultra-fast 8B model for latency-critical workloads",
  },
  {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B (Cerebras)",
    inputPricePer1M: 0.85,
    outputPricePer1M: 1.20,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools"],
  },
]
