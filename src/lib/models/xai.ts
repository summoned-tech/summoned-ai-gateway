import type { ModelDefinition } from "./types"

export const XAI_MODELS: ModelDefinition[] = [
  {
    id: "grok-3",
    name: "Grok 3",
    inputPricePer1M: 3.00,
    outputPricePer1M: 15.00,
    contextWindow: 131_072,
    capabilities: ["streaming", "tools", "vision"],
    description: "xAI's most capable flagship model",
  },
  {
    id: "grok-3-mini",
    name: "Grok 3 Mini",
    inputPricePer1M: 0.30,
    outputPricePer1M: 0.50,
    contextWindow: 131_072,
    capabilities: ["streaming", "tools", "reasoning"],
    description: "Lightweight reasoning model",
  },
  {
    id: "grok-2",
    name: "Grok 2",
    inputPricePer1M: 2.00,
    outputPricePer1M: 10.00,
    contextWindow: 131_072,
    capabilities: ["streaming", "tools", "vision"],
  },
  {
    id: "grok-2-vision",
    name: "Grok 2 Vision",
    inputPricePer1M: 2.00,
    outputPricePer1M: 10.00,
    contextWindow: 32_768,
    capabilities: ["streaming", "tools", "vision"],
  },
]
