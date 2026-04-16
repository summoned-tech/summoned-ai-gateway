import type { ModelDefinition } from "./types"

/**
 * Azure OpenAI uses deployment names rather than model IDs.
 * Pricing matches OpenAI but may vary by region/agreement.
 * We list the common model deployments here for cost tracking.
 */
export const AZURE_OPENAI_MODELS: ModelDefinition[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o (Azure)",
    inputPricePer1M: 2.50,
    outputPricePer1M: 10.00,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools", "vision", "json_mode"],
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini (Azure)",
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.60,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools", "json_mode"],
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo (Azure)",
    inputPricePer1M: 10.00,
    outputPricePer1M: 30.00,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools", "vision"],
  },
]
