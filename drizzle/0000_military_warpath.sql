CREATE TYPE "public"."request_log_status" AS ENUM('success', 'error', 'rate_limited', 'auth_failed');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"key_hash" text NOT NULL,
	"name" text NOT NULL,
	"tenant_id" text NOT NULL,
	"rate_limit_rpm" integer DEFAULT 60 NOT NULL,
	"rate_limit_tpd" integer DEFAULT 1000000 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "request_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"api_key_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text,
	"organization_id" text,
	"requested_model" text NOT NULL,
	"resolved_model" text NOT NULL,
	"provider" text DEFAULT 'bedrock' NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"streaming" boolean DEFAULT false NOT NULL,
	"status" "request_log_status" NOT NULL,
	"error_message" text,
	"cost_usd" real,
	"cost_inr" real,
	"cache_hit" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "virtual_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"provider_id" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"provider_config" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "api_keys_tenant_idx" ON "api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "api_keys_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "request_logs_tenant_idx" ON "request_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "request_logs_api_key_idx" ON "request_logs" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "request_logs_created_at_idx" ON "request_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "virtual_keys_tenant_idx" ON "virtual_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "virtual_keys_provider_idx" ON "virtual_keys" USING btree ("provider_id");