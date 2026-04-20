import { createOpenAICompatProvider } from "./openai-compat"

// Nvidia NIM — inference microservices hosted on build.nvidia.com.
// Also works against self-hosted NIMs by configuring a custom baseURL via
// CUSTOM_PROVIDERS instead of enabling this provider.
export function createNvidiaNimProvider(apiKey: string) {
  return createOpenAICompatProvider({
    id: "nvidia",
    name: "Nvidia NIM",
    apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
  })
}
