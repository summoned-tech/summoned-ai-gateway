import type { ModelDefinition } from "./types"

export const GROQ_MODELS: ModelDefinition[] = [
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B Versatile",
    inputPricePer1M: 0.59,
    outputPricePer1M: 0.79,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools", "json_mode"],
    description: "High-quality open model at high speed",
  },
  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B Instant",
    inputPricePer1M: 0.05,
    outputPricePer1M: 0.08,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools"],
    description: "Ultra-fast lightweight model",
  },
  {
    id: "mixtral-8x7b-32768",
    name: "Mixtral 8x7B",
    inputPricePer1M: 0.24,
    outputPricePer1M: 0.24,
    contextWindow: 32_768,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "gemma2-9b-it",
    name: "Gemma 2 9B",
    inputPricePer1M: 0.20,
    outputPricePer1M: 0.20,
    contextWindow: 8_192,
    capabilities: ["streaming"],
  },
  {
    id: "llama-3.1-70b-versatile",
    name: "Llama 3.1 70B Versatile",
    inputPricePer1M: 0.59,
    outputPricePer1M: 0.79,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools"],
  },
]
