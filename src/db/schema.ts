import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
  pgEnum,
  jsonb,
  real,
} from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// API Keys — tenants authenticate via bearer token (hashed in DB)
// ---------------------------------------------------------------------------

export const apiKey = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    keyHash: text("key_hash").notNull().unique(),
    name: text("name").notNull(),
    tenantId: text("tenant_id").notNull(),
    rateLimitRpm: integer("rate_limit_rpm").notNull().default(60),
    rateLimitTpd: integer("rate_limit_tpd").notNull().default(1_000_000),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (t) => [
    index("api_keys_tenant_idx").on(t.tenantId),
    index("api_keys_hash_idx").on(t.keyHash),
  ],
)

// ---------------------------------------------------------------------------
// Virtual Keys — wrap provider credentials so SDK users never expose real keys
// Like Portkey's virtual keys: create once, reference by alias in requests.
// ---------------------------------------------------------------------------

export const virtualKey = pgTable(
  "virtual_keys",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    providerId: text("provider_id").notNull(),
    // AES-256-GCM encrypted provider API key (iv:ciphertext:tag)
    encryptedKey: text("encrypted_key").notNull(),
    // Provider-specific config (e.g. Azure endpoint, AWS region)
    providerConfig: jsonb("provider_config").$type<Record<string, string>>(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (t) => [
    index("virtual_keys_tenant_idx").on(t.tenantId),
    index("virtual_keys_provider_idx").on(t.providerId),
  ],
)

// ---------------------------------------------------------------------------
// Prompts — versioned prompt templates resolved at request time
// See rfcs/0001-prompt-management.md
// ---------------------------------------------------------------------------

export const prompt = pgTable(
  "prompts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    slug: text("slug").notNull(),
    version: integer("version").notNull(),
    // OpenAI-format messages with `{{var}}` placeholders
    template: jsonb("template").$type<Array<Record<string, unknown>>>().notNull(),
    // Optional { name: default_value } map
    variables: jsonb("variables").$type<Record<string, string>>(),
    defaultModel: text("default_model"),
    description: text("description"),
    isLatest: boolean("is_latest").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("prompts_tenant_idx").on(t.tenantId),
    index("prompts_tenant_slug_idx").on(t.tenantId, t.slug),
  ],
)

// ---------------------------------------------------------------------------
// Request Logs — immutable audit trail for every completion request
// ---------------------------------------------------------------------------

export const requestLogStatusEnum = pgEnum("request_log_status", [
  "success",
  "error",
  "rate_limited",
  "auth_failed",
])

export const requestLog = pgTable(
  "request_logs",
  {
    id: text("id").primaryKey(),
    apiKeyId: text("api_key_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id"),
    organizationId: text("organization_id"),
    requestedModel: text("requested_model").notNull(),
    resolvedModel: text("resolved_model").notNull(),
    provider: text("provider").notNull().default("bedrock"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    streaming: boolean("streaming").notNull().default(false),
    status: requestLogStatusEnum("status").notNull(),
    errorMessage: text("error_message"),
    costUsd: real("cost_usd"),
    costInr: real("cost_inr"),
    cacheHit: boolean("cache_hit").default(false),
    promptId: text("prompt_id"),
    promptVersion: integer("prompt_version"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("request_logs_tenant_idx").on(t.tenantId),
    index("request_logs_api_key_idx").on(t.apiKeyId),
    index("request_logs_created_at_idx").on(t.createdAt),
  ],
)
