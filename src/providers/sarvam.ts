import { createOpenAICompatProvider } from "./openai-compat"

export function createSarvamProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "sarvam",
    name: "Sarvam AI",
    // Sarvam accepts both Authorization: Bearer and api-subscription-key headers.
    // Passing the key in both ensures compatibility regardless of which Sarvam validates.
    apiKey,
    baseURL: "https://api.sarvam.ai/v1",
    headers: {
      "api-subscription-key": apiKey,
    },
  })
}
