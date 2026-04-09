import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.enum(["local", "development", "test", "staging", "production"]).default("local"),
  GATEWAY_PORT: z.coerce.number().default(4000),

  // Admin — used to create/rotate API keys via POST /v1/keys
  ADMIN_API_KEY: z.string().min(32),

  // AWS Bedrock (ap-south-1 — DPDP compliant)
  AWS_REGION: z.string().default("ap-south-1"),
  AWS_ACCESS_KEY_ID: z.string().default(""),
  AWS_SECRET_ACCESS_KEY: z.string().default(""),
  // Optional: Bedrock-specific API key (overrides IAM credentials when set)
  AWS_BEDROCK_API_KEY: z.string().default(""),
  // Demo mode: routes all tiers to Nova Lite to conserve budget
  BEDROCK_DEMO_MODE: z.string().default("false").transform((v) => v === "true"),

  // PostgreSQL — audit logs, API keys
  POSTGRES_URL: z.string().url(),

  // Redis — rate limiting, key cache
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default(""),
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
