import type { ModelDefinition } from "./types"

// Nvidia NIM hosted on build.nvidia.com is currently free for evaluation and
// the API doesn't publish stable per-token pricing. Leave pricing at zero so
// calculateCost returns priceUnknown=false with $0 — accurate for free tier.
export const NVIDIA_MODELS: ModelDefinition[] = [
  {
    id: "meta/llama-3.1-405b-instruct",
    name: "Llama 3.1 405B (NIM)",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    contextWindow: 128_000,
    capabilities: ["streaming", "tools"],
  },
  {
    id: "nvidia/llama-3.1-nemotron-70b-instruct",
    name: "Nemotron 70B (NIM)",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    contextWindow: 128_000,
    capabilities: ["streaming"],
  },
]
