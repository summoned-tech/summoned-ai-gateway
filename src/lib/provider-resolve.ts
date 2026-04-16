import { eq, and } from "drizzle-orm"
import { db, virtualKey } from "@/lib/db"
import { decrypt } from "@/lib/crypto"
import { redis } from "@/lib/redis"
import { registry } from "@/providers/registry"
import { logger } from "@/lib/telemetry"
import type { ProviderAdapter } from "@/providers/base"

const VK_CACHE_TTL = 300

/**
 * Resolve a virtual key to a provider adapter with the stored credentials.
 * This creates a one-off provider instance using the decrypted API key.
 *
 * Portkey equivalent: x-portkey-virtual-key header → resolves to stored provider creds.
 */
export async function resolveVirtualKey(
  vkId: string,
  tenantId: string,
): Promise<{ provider: ProviderAdapter; providerId: string } | null> {
  const cacheKey = `vk:${vkId}`
  let record: {
    id: string
    providerId: string
    encryptedKey: string
    providerConfig: Record<string, string> | null
  } | null = null

  const cached = await redis.get(cacheKey)
  if (cached) {
    record = JSON.parse(cached)
  } else {
    const rows = await db
      .select({
        id: virtualKey.id,
        tenantId: virtualKey.tenantId,
        providerId: virtualKey.providerId,
        encryptedKey: virtualKey.encryptedKey,
        providerConfig: virtualKey.providerConfig,
        isActive: virtualKey.isActive,
      })
      .from(virtualKey)
      .where(and(eq(virtualKey.id, vkId), eq(virtualKey.tenantId, tenantId)))
      .limit(1)

    if (!rows.length || !rows[0].isActive) return null

    record = {
      id: rows[0].id,
      providerId: rows[0].providerId,
      encryptedKey: rows[0].encryptedKey,
      providerConfig: rows[0].providerConfig,
    }
    await redis.setex(cacheKey, VK_CACHE_TTL, JSON.stringify(record))
  }

  if (!record) return null

  const apiKey = await decrypt(record.encryptedKey)
  const adapter = await createEphemeralProvider(record.providerId, apiKey, record.providerConfig)

  // Update last_used_at async
  db.update(virtualKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(virtualKey.id, record.id))
    .catch((e) => logger.error({ err: e }, "failed to update virtual key last_used_at"))

  return adapter ? { provider: adapter, providerId: record.providerId } : null
}

/**
 * Create a one-off provider adapter with a specific API key.
 * Used for both virtual keys and header-based credential forwarding.
 */
export async function createEphemeralProvider(
  providerId: string,
  apiKey: string,
  config?: Record<string, string> | null,
): Promise<ProviderAdapter | null> {
  switch (providerId) {
    case "openai": {
      const { createOpenAIProvider } = await import("@/providers/openai")
      return createOpenAIProvider(apiKey)
    }
    case "anthropic": {
      const { createAnthropicProvider } = await import("@/providers/anthropic")
      return createAnthropicProvider(apiKey)
    }
    case "google": {
      const { createGoogleProvider } = await import("@/providers/google")
      return createGoogleProvider(apiKey)
    }
    case "groq": {
      const { createGroqProvider } = await import("@/providers/groq")
      return createGroqProvider(apiKey)
    }
    case "azure": {
      const endpoint = config?.endpoint ?? ""
      if (!endpoint) return null
      const { createAzureOpenAIProvider } = await import("@/providers/azure-openai")
      return createAzureOpenAIProvider(apiKey, endpoint)
    }
    case "ollama": {
      const baseUrl = config?.baseUrl ?? "http://localhost:11434"
      const { createOllamaProvider } = await import("@/providers/ollama")
      return createOllamaProvider(baseUrl)
    }
    case "sarvam": {
      const { createSarvamProvider } = await import("@/providers/sarvam")
      return createSarvamProvider(apiKey)
    }
    case "yotta": {
      const { createYottaProvider } = await import("@/providers/yotta")
      return createYottaProvider(apiKey)
    }
    case "mistral": {
      const { createMistralProvider } = await import("@/providers/mistral")
      return createMistralProvider(apiKey)
    }
    case "together": {
      const { createTogetherProvider } = await import("@/providers/together")
      return createTogetherProvider(apiKey)
    }
    case "deepseek": {
      const { createDeepSeekProvider } = await import("@/providers/deepseek")
      return createDeepSeekProvider(apiKey)
    }
    case "fireworks": {
      const { createFireworksProvider } = await import("@/providers/fireworks")
      return createFireworksProvider(apiKey)
    }
    case "cohere": {
      const { createCohereProvider } = await import("@/providers/cohere")
      return createCohereProvider(apiKey)
    }
    case "cerebras": {
      const { createCerebrasProvider } = await import("@/providers/cerebras")
      return createCerebrasProvider(apiKey)
    }
    case "perplexity": {
      const { createPerplexityProvider } = await import("@/providers/perplexity")
      return createPerplexityProvider(apiKey)
    }
    case "xai": {
      const { createXAIProvider } = await import("@/providers/xai")
      return createXAIProvider(apiKey)
    }
    case "bedrock": {
      // x-provider-key format: "[region|]bearer-token"
      // e.g. "us-east-1|your-bedrock-api-key"  OR  "your-bedrock-api-key"
      let region: string | undefined
      let bearerToken = apiKey
      const pipeIdx = apiKey.indexOf("|")
      if (pipeIdx !== -1) {
        region = apiKey.slice(0, pipeIdx)
        bearerToken = apiKey.slice(pipeIdx + 1)
      }
      const { createBedrockByokProvider } = await import("@/providers/bedrock")
      return createBedrockByokProvider(bearerToken, region)
    }
    default: {
      // Try to find in registry (handles custom providers registered at startup)
      const registered = registry.get(providerId)
      if (registered) {
        logger.debug({ providerId }, "ephemeral provider resolved from registry")
        return registered
      }
      logger.warn({ providerId }, "unknown provider for ephemeral creation")
      return null
    }
  }
}
