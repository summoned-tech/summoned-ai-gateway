import { createOpenAICompatProvider } from "./openai-compat"

// OpenRouter — meta-provider aggregating 100+ models under one API key.
// Model IDs are namespaced by upstream (e.g. "openai/gpt-4o", "anthropic/claude-3.5-sonnet").
// In our slug format users write "openrouter/openai/gpt-4o" — parseModelSlug
// splits at the first "/", leaving "openai/gpt-4o" as the model ID for OpenRouter.
export function createOpenRouterProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "openrouter",
    name: "OpenRouter",
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer": "https://summoned.tech",
      "X-Title": "Summoned AI Gateway",
    },
  })
}
