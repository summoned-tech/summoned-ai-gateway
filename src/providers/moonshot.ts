import { createOpenAICompatProvider } from "./openai-compat"

// Moonshot AI (Kimi) — 200K+ context windows, strong on long-doc tasks.
// Use the international endpoint; api.moonshot.cn is the mainland China variant.
export function createMoonshotProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "moonshot",
    name: "Moonshot AI",
    apiKey,
    baseURL: "https://api.moonshot.ai/v1",
  })
}
