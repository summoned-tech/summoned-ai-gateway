import type { ModelDefinition } from "./types"

export const PERPLEXITY_MODELS: ModelDefinition[] = [
  {
    id: "llama-3.1-sonar-large-128k-online",
    name: "Sonar Large (Online)",
    inputPricePer1M: 1.00,
    outputPricePer1M: 1.00,
    contextWindow: 127_072,
    capabilities: ["streaming", "search"],
    description: "Llama 3.1 70B + real-time web search",
  },
  {
    id: "llama-3.1-sonar-small-128k-online",
    name: "Sonar Small (Online)",
    inputPricePer1M: 0.20,
    outputPricePer1M: 0.20,
    contextWindow: 127_072,
    capabilities: ["streaming", "search"],
    description: "Llama 3.1 8B + real-time web search, cost-efficient",
  },
  {
    id: "llama-3.1-sonar-large-128k-chat",
    name: "Sonar Large (Chat)",
    inputPricePer1M: 1.00,
    outputPricePer1M: 1.00,
    contextWindow: 131_072,
    capabilities: ["streaming"],
    description: "High-quality chat model without web search",
  },
  {
    id: "llama-3.1-sonar-small-128k-chat",
    name: "Sonar Small (Chat)",
    inputPricePer1M: 0.20,
    outputPricePer1M: 0.20,
    contextWindow: 131_072,
    capabilities: ["streaming"],
  },
]
