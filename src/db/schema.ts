import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
  pgEnum,
} from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// API Keys — tenants authenticate via bearer token (hashed in DB)
// ---------------------------------------------------------------------------

export const apiKey = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    // SHA-256 hex of the raw key — raw key shown once at creation, never stored
    keyHash: text("key_hash").notNull().unique(),
    name: text("name").notNull(),
    tenantId: text("tenant_id").notNull(),
    // Requests per minute (sliding window, enforced in Redis)
    rateLimitRpm: integer("rate_limit_rpm").notNull().default(60),
    // Tokens per day (tracked in Redis, reset at midnight UTC)
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
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("request_logs_tenant_idx").on(t.tenantId),
    index("request_logs_api_key_idx").on(t.apiKeyId),
    index("request_logs_created_at_idx").on(t.createdAt),
  ],
)
