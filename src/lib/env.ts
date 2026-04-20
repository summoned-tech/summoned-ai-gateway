import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.enum(["local", "development", "test", "staging", "production"]).default("local"),
  GATEWAY_PORT: z.coerce.number().default(4000),

  // Admin — used to create/rotate API keys via POST /v1/keys
  // Auto-generated for local/dev if unset; required explicitly in production.
  ADMIN_API_KEY: z.string().default(""),

  // Encryption key for virtual keys (AES-256-GCM via HKDF).
  // Generate: openssl rand -hex 32
  // If unset, falls back to ADMIN_API_KEY (not recommended for production).
  VIRTUAL_KEY_SECRET: z.string().default(""),

  // ---------------------------------------------------------------------------
  // Provider credentials — set the keys for providers you want to enable.
  // Only providers with valid credentials are registered at startup.
  // ---------------------------------------------------------------------------

  // AWS Bedrock (ap-south-1 — DPDP compliant)
  AWS_REGION: z.string().default("ap-south-1"),
  AWS_ACCESS_KEY_ID: z.string().default(""),
  AWS_SECRET_ACCESS_KEY: z.string().default(""),
  AWS_BEDROCK_API_KEY: z.string().default(""),
  // Opt-in to rely on EC2 / ECS / EKS instance-profile credentials (IAM role).
  // When true, Bedrock is registered without explicit keys and the AWS SDK's
  // default credential chain resolves the role automatically.
  AWS_USE_INSTANCE_PROFILE: z.string().default("false").transform((v) => v === "true"),
  BEDROCK_DEMO_MODE: z.string().default("false").transform((v) => v === "true"),

  // OpenAI
  OPENAI_API_KEY: z.string().default(""),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().default(""),

  // Google Gemini
  GOOGLE_API_KEY: z.string().default(""),

  // Groq
  GROQ_API_KEY: z.string().default(""),

  // Azure OpenAI
  AZURE_OPENAI_API_KEY: z.string().default(""),
  AZURE_OPENAI_ENDPOINT: z.string().default(""),

  // Ollama (local inference)
  OLLAMA_BASE_URL: z.string().default(""),

  // Sarvam AI (India-first multilingual)
  SARVAM_API_KEY: z.string().default(""),

  // Yotta Labs (Indian GPU cloud gateway)
  YOTTA_API_KEY: z.string().default(""),

  // Mistral AI
  MISTRAL_API_KEY: z.string().default(""),

  // Together AI
  TOGETHER_API_KEY: z.string().default(""),

  // DeepSeek
  DEEPSEEK_API_KEY: z.string().default(""),

  // Fireworks AI
  FIREWORKS_API_KEY: z.string().default(""),

  // Cohere
  COHERE_API_KEY: z.string().default(""),

  // Cerebras
  CEREBRAS_API_KEY: z.string().default(""),

  // Perplexity
  PERPLEXITY_API_KEY: z.string().default(""),

  // xAI / Grok
  XAI_API_KEY: z.string().default(""),

  // OpenRouter — aggregator for 100+ models across providers
  OPENROUTER_API_KEY: z.string().default(""),

  // HuggingFace Inference Router
  HUGGINGFACE_API_KEY: z.string().default(""),

  // DeepInfra
  DEEPINFRA_API_KEY: z.string().default(""),

  // Hyperbolic
  HYPERBOLIC_API_KEY: z.string().default(""),

  // SambaNova
  SAMBANOVA_API_KEY: z.string().default(""),

  // Novita AI
  NOVITA_API_KEY: z.string().default(""),

  // Moonshot AI (Kimi)
  MOONSHOT_API_KEY: z.string().default(""),

  // Z.AI (Zhipu / GLM)
  ZAI_API_KEY: z.string().default(""),

  // Nvidia NIM
  NVIDIA_API_KEY: z.string().default(""),

  // vLLM — generic self-hosted OpenAI-compat server. Base URL required; key optional.
  VLLM_BASE_URL: z.string().default(""),
  VLLM_API_KEY: z.string().default(""),

  // Voyage AI — embeddings + reranking
  VOYAGE_API_KEY: z.string().default(""),

  // Custom OpenAI-compatible providers — JSON array of {id, name, baseUrl, apiKey}
  // Example: [{"id":"myprovider","name":"My LLM","baseUrl":"https://api.example.com/v1","apiKey":"sk-..."}]
  CUSTOM_PROVIDERS: z.string().default(""),

  // ---------------------------------------------------------------------------
  // Infrastructure
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Auth & public mode
  // ---------------------------------------------------------------------------

  // Set to "false" to allow unauthenticated requests (BYOK public deployments).
  // In that mode callers must supply their own provider key via x-provider-key header.
  GATEWAY_REQUIRE_AUTH: z.string().default("true").transform((v) => v !== "false"),

  // RPM cap for public/BYOK callers (no sk-smnd- key). Per source-IP.
  PUBLIC_RPM_LIMIT: z.coerce.number().default(60),

  // ---------------------------------------------------------------------------
  // Infrastructure
  // ---------------------------------------------------------------------------

  // PostgreSQL — audit logs, API keys (optional when GATEWAY_REQUIRE_AUTH=false)
  POSTGRES_URL: z.string().default(""),

  // Redis — rate limiting, caching, latency EMA (optional; in-memory fallbacks used when absent)
  REDIS_URL: z.string().default(""),

  // Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default(""),

  // Cost tracking — USD to INR conversion rate
  USD_INR_RATE: z.coerce.number().default(85),
})

function load() {
  const result = schema.safeParse(process.env)
  if (!result.success) {
    console.error("[summoned-gateway] Invalid env:", result.error.flatten().fieldErrors)
    throw new Error("Invalid environment variables")
  }

  const data = result.data

  if (!data.ADMIN_API_KEY) {
    if (data.NODE_ENV === "production" || data.NODE_ENV === "staging") {
      console.error("[summoned-gateway] ADMIN_API_KEY must be set in production/staging. Generate one with: openssl rand -hex 32")
      throw new Error("ADMIN_API_KEY required")
    }
    const randomKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    data.ADMIN_API_KEY = randomKey
    const border = "═".repeat(66)
    console.warn(`\n${border}\n  ADMIN_API_KEY auto-generated (ephemeral — changes every restart)\n  Use this key for the console and POST /v1/keys:\n\n    ${randomKey}\n\n  Set ADMIN_API_KEY env var explicitly to persist across restarts.\n${border}\n`)
  } else if (data.ADMIN_API_KEY.length < 32) {
    console.error("[summoned-gateway] ADMIN_API_KEY must be at least 32 characters")
    throw new Error("ADMIN_API_KEY too short")
  }

  return data
}

export const env = load()
