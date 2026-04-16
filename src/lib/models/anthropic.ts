import type { ModelDefinition } from "./types"

export const ANTHROPIC_MODELS: ModelDefinition[] = [
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    inputPricePer1M: 3.00,
    outputPricePer1M: 15.00,
    contextWindow: 200_000,
    capabilities: ["streaming", "tools", "vision", "json_mode"],
  },
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    inputPricePer1M: 3.00,
    outputPricePer1M: 15.00,
    contextWindow: 200_000,
    capabilities: ["streaming", "tools", "vision", "json_mode"],
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    inputPricePer1M: 0.80,
    outputPricePer1M: 4.00,
    contextWindow: 200_000,
    capabilities: ["streaming", "tools", "json_mode"],
  },
  {
    id: "claude-3-haiku-20240307",
    name: "Claude 3 Haiku",
    inputPricePer1M: 0.25,
    outputPricePer1M: 1.25,
    contextWindow: 200_000,
    capabilities: ["streaming", "tools", "vision"],
  },
  {
    id: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    inputPricePer1M: 15.00,
    outputPricePer1M: 75.00,
    contextWindow: 200_000,
    capabilities: ["streaming", "tools", "vision"],
  },
]
