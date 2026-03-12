CREATE TYPE "public"."feature_approval_status" AS ENUM('pending', 'approved', 'rejected', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."feature_approval_type" AS ENUM('spec_plan', 'human_qa', 'registration');--> statement-breakpoint
CREATE TYPE "public"."feature_artifact_kind" AS ENUM('spec', 'plan', 'implementation_summary', 'verification_report', 'agent_qa_report', 'human_qa_notes', 'registration_manifest', 'preview_metadata');--> statement-breakpoint
CREATE TYPE "public"."feature_registration_status" AS ENUM('pending', 'registered', 'failed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."feature_request_message_kind" AS ENUM('conversation', 'event', 'note');--> statement-breakpoint
CREATE TYPE "public"."feature_request_message_role" AS ENUM('system', 'assistant', 'user');--> statement-breakpoint
CREATE TYPE "public"."feature_request_status" AS ENUM('draft', 'spec_ready', 'pending_spec_approval', 'plan_approved', 'implementing', 'verifying', 'preview_deploying', 'agent_qa', 'pending_human_qa', 'customization', 'pending_registration', 'registered', 'failed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."feature_run_status" AS ENUM('queued', 'running', 'paused', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "feature_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"feature_key" varchar(200) NOT NULL,
	"registry_version" integer DEFAULT 1 NOT NULL,
	"status" "feature_registration_status" DEFAULT 'pending' NOT NULL,
	"registered_by_id" uuid,
	"registered_commit_sha" varchar(64),
	"registration_metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "feature_request_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"approval_type" "feature_approval_type" NOT NULL,
	"status" "feature_approval_status" DEFAULT 'pending' NOT NULL,
	"requested_from_id" uuid,
	"decided_by_id" uuid,
	"decision_notes" text,
	"approved_artifact_version" integer
);
--> statement-breakpoint
CREATE TABLE "feature_request_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"kind" "feature_artifact_kind" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "feature_request_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"role" "feature_request_message_role" NOT NULL,
	"kind" "feature_request_message_kind" DEFAULT 'conversation' NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "feature_request_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"workflow_name" varchar(100) NOT NULL,
	"workflow_step" varchar(100) NOT NULL,
	"status" "feature_run_status" DEFAULT 'queued' NOT NULL,
	"resume_token" text,
	"last_error" text,
	"retry_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_request_worktrees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"feature_request_id" uuid NOT NULL,
	"worktree_path" text NOT NULL,
	"branch_name" varchar(255) NOT NULL,
	"base_branch" varchar(255) NOT NULL,
	"head_commit_sha" varchar(64),
	"last_verified_commit_sha" varchar(64),
	"preview_url" text,
	"preview_provider" varchar(50),
	"preview_commit_sha" varchar(64),
	"preview_status" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "feature_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" varchar(200) NOT NULL,
	"summary" text,
	"raw_prompt" text NOT NULL,
	"status" "feature_request_status" DEFAULT 'draft' NOT NULL,
	"ruleset_reference" text,
	"current_run_id" uuid,
	"created_by_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feature_registrations" ADD CONSTRAINT "feature_registrations_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_registrations" ADD CONSTRAINT "feature_registrations_registered_by_id_profiles_id_fk" FOREIGN KEY ("registered_by_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_request_approvals" ADD CONSTRAINT "feature_request_approvals_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_request_approvals" ADD CONSTRAINT "feature_request_approvals_requested_from_id_profiles_id_fk" FOREIGN KEY ("requested_from_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_request_approvals" ADD CONSTRAINT "feature_request_approvals_decided_by_id_profiles_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_request_artifacts" ADD CONSTRAINT "feature_request_artifacts_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_request_artifacts" ADD CONSTRAINT "feature_request_artifacts_created_by_id_profiles_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_request_messages" ADD CONSTRAINT "feature_request_messages_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_request_runs" ADD CONSTRAINT "feature_request_runs_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_request_worktrees" ADD CONSTRAINT "feature_request_worktrees_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_created_by_id_profiles_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;