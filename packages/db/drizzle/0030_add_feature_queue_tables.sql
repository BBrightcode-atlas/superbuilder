CREATE TYPE "public"."feature_queue_batch_status" AS ENUM('pending', 'processing', 'completed', 'partial_failed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."feature_queue_item_complexity" AS ENUM('light', 'medium', 'heavy');--> statement-breakpoint
CREATE TYPE "public"."feature_queue_item_status" AS ENUM('pending', 'waiting_deps', 'processing', 'paused', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "feature_queue_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"title" varchar(300),
	"status" "feature_queue_batch_status" DEFAULT 'pending' NOT NULL,
	"concurrency_limit" integer DEFAULT 1 NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"completed_items" integer DEFAULT 0 NOT NULL,
	"failed_items" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_queue_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"feature_request_id" uuid,
	"position" integer NOT NULL,
	"status" "feature_queue_item_status" DEFAULT 'pending' NOT NULL,
	"raw_prompt" text NOT NULL,
	"title" varchar(200),
	"estimated_complexity" "feature_queue_item_complexity" DEFAULT 'medium' NOT NULL,
	"session_id" varchar(255),
	"resume_token" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"metadata" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feature_queue_batches" ADD CONSTRAINT "feature_queue_batches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_queue_batches" ADD CONSTRAINT "feature_queue_batches_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_queue_items" ADD CONSTRAINT "feature_queue_items_batch_id_feature_queue_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."feature_queue_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_queue_items" ADD CONSTRAINT "feature_queue_items_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feature_queue_batches_created_by_idx" ON "feature_queue_batches" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "feature_queue_batches_status_idx" ON "feature_queue_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feature_queue_batches_created_at_idx" ON "feature_queue_batches" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feature_queue_items_batch_idx" ON "feature_queue_items" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "feature_queue_items_status_idx" ON "feature_queue_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feature_queue_items_session_idx" ON "feature_queue_items" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "feature_queue_items_processing_idx" ON "feature_queue_items" USING btree ("status","position");