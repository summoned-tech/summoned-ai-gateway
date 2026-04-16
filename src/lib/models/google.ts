import type { ModelDefinition } from "./types"

export const GOOGLE_MODELS: ModelDefinition[] = [
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    inputPricePer1M: 0.10,
    outputPricePer1M: 0.40,
    contextWindow: 1_048_576,
    capabilities: ["streaming", "tools", "vision", "json_mode"],
  },
  {
    id: "gemini-2.0-flash-lite",
    name: "Gemini 2.0 Flash Lite",
    inputPricePer1M: 0.075,
    outputPricePer1M: 0.30,
    contextWindow: 1_048_576,
    capabilities: ["streaming", "tools", "vision"],
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    inputPricePer1M: 1.25,
    outputPricePer1M: 5.00,
    contextWindow: 2_097_152,
    capabilities: ["streaming", "tools", "vision", "json_mode"],
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    inputPricePer1M: 0.075,
    outputPricePer1M: 0.30,
    contextWindow: 1_048_576,
    capabilities: ["streaming", "tools", "vision", "json_mode"],
  },
  {
    id: "gemini-1.5-flash-8b",
    name: "Gemini 1.5 Flash 8B",
    inputPricePer1M: 0.0375,
    outputPricePer1M: 0.15,
    contextWindow: 1_048_576,
    capabilities: ["streaming", "tools", "vision"],
  },
]
