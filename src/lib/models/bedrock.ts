import type { ModelDefinition } from "./types"

export const BEDROCK_MODELS: ModelDefinition[] = [
  // Anthropic on Bedrock
  {
    id: "anthropic.claude-sonnet-4-20250514-v1:0",
    name: "Claude Sonnet 4 (Bedrock)",
    inputPricePer1M: 3.00,
    outputPricePer1M: 15.00,
    contextWindow: 200_000,
    capabilities: ["streaming", "tools", "vision", "json_mode"],
  },
  {
    id: "anthropic.claude-3-5-sonnet-20241022-v2:0",
    name: "Claude 3.5 Sonnet v2 (Bedrock)",
    inputPricePer1M: 3.00,
    outputPricePer1M: 15.00,
    contextWindow: 200_000,
    capabilities: ["streaming", "tools", "vision"],
  },
  {
    id: "anthropic.claude-3-haiku-20240307-v1:0",
    name: "Claude 3 Haiku (Bedrock)",
    inputPricePer1M: 0.25,
    outputPricePer1M: 1.25,
    contextWindow: 200_000,
    capabilities: ["streaming", "tools", "vision"],
  },
  // Amazon Nova — DPDP-compliant, ap-south-1 default
  {
    id: "amazon.nova-pro-v1:0",
    name: "Amazon Nova Pro",
    inputPricePer1M: 0.80,
    outputPricePer1M: 3.20,
    contextWindow: 300_000,
    capabilities: ["streaming", "tools", "vision"],
    description: "Amazon's flagship multimodal model — hosted in ap-south-1 by default",
  },
  {
    id: "amazon.nova-lite-v1:0",
    name: "Amazon Nova Lite",
    inputPricePer1M: 0.06,
    outputPricePer1M: 0.24,
    contextWindow: 300_000,
    capabilities: ["streaming", "tools", "vision"],
    description: "Cost-optimised multimodal model",
  },
  {
    id: "amazon.nova-micro-v1:0",
    name: "Amazon Nova Micro",
    inputPricePer1M: 0.035,
    outputPricePer1M: 0.14,
    contextWindow: 128_000,
    capabilities: ["streaming"],
    description: "Text-only, extremely cost-efficient",
  },
  // Meta Llama on Bedrock
  {
    id: "meta.llama3-70b-instruct-v1:0",
    name: "Llama 3 70B (Bedrock)",
    inputPricePer1M: 2.65,
    outputPricePer1M: 3.50,
    contextWindow: 8_192,
    capabilities: ["streaming"],
  },
]
