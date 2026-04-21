CREATE TABLE "prompts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"slug" text NOT NULL,
	"version" integer NOT NULL,
	"template" jsonb NOT NULL,
	"variables" jsonb,
	"default_model" text,
	"description" text,
	"is_latest" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "prompt_id" text;--> statement-breakpoint
ALTER TABLE "request_logs" ADD COLUMN "prompt_version" integer;--> statement-breakpoint
CREATE INDEX "prompts_tenant_idx" ON "prompts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "prompts_tenant_slug_idx" ON "prompts" USING btree ("tenant_id","slug");