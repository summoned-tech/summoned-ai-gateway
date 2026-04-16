import type { ModelDefinition } from "./types"

export const COHERE_MODELS: ModelDefinition[] = [
  {
    id: "command-r-plus",
    name: "Command R+",
    inputPricePer1M: 2.50,
    outputPricePer1M: 10.00,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools", "search"],
    description: "High performance RAG and tool use model",
  },
  {
    id: "command-r",
    name: "Command R",
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.60,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools", "search"],
  },
  {
    id: "command-r7b-12-2024",
    name: "Command R7B",
    inputPricePer1M: 0.0375,
    outputPricePer1M: 0.15,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools"],
    description: "Efficient 7B model for high-throughput workloads",
  },
]
