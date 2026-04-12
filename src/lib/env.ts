import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.enum(["local", "development", "test", "staging", "production"]).default("local"),
  GATEWAY_PORT: z.coerce.number().default(4000),

  // Admin — used to create/rotate API keys via POST /v1/keys
  ADMIN_API_KEY: z.string().min(32),

  // ---------------------------------------------------------------------------
  // Provider credentials — set the keys for providers you want to enable.
  // Only providers with valid credentials are registered at startup.
  // ---------------------------------------------------------------------------

  // AWS Bedrock (ap-south-1 — DPDP compliant)
  AWS_REGION: z.string().default("ap-south-1"),
  AWS_ACCESS_KEY_ID: z.string().default(""),
  AWS_SECRET_ACCESS_KEY: z.string().default(""),
  AWS_BEDROCK_API_KEY: z.string().default(""),
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

  // ---------------------------------------------------------------------------
  // Infrastructure
  // ---------------------------------------------------------------------------

  // PostgreSQL — audit logs, API keys
  POSTGRES_URL: z.string().url(),

  // Redis — rate limiting, key cache
  REDIS_URL: z.string().default("redis://localhost:6379"),

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
  return result.data
}

export const env = load()
