import {
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { organizations, users } from "./auth";
import {
	featureApprovalStatusValues,
	featureApprovalTypeValues,
	featureArtifactKindValues,
	featureQueueBatchStatusValues,
	featureQueueItemComplexityValues,
	featureQueueItemStatusValues,
	featureRegistrationStatusValues,
	featureRequestMessageKindValues,
	featureRequestMessageRoleValues,
	featureRequestStatusValues,
	featureRunStatusValues,
} from "./enums";

// Enums
export const featureRequestStatus = pgEnum(
	"feature_request_status",
	featureRequestStatusValues,
);
export const featureRequestMessageRole = pgEnum(
	"feature_request_message_role",
	featureRequestMessageRoleValues,
);
export const featureRequestMessageKind = pgEnum(
	"feature_request_message_kind",
	featureRequestMessageKindValues,
);
export const featureArtifactKind = pgEnum(
	"feature_artifact_kind",
	featureArtifactKindValues,
);
export const featureApprovalType = pgEnum(
	"feature_approval_type",
	featureApprovalTypeValues,
);
export const featureApprovalStatus = pgEnum(
	"feature_approval_status",
	featureApprovalStatusValues,
);
export const featureRunStatus = pgEnum(
	"feature_run_status",
	featureRunStatusValues,
);
export const featureRegistrationStatus = pgEnum(
	"feature_registration_status",
	featureRegistrationStatusValues,
);
export const featureQueueBatchStatus = pgEnum(
	"feature_queue_batch_status",
	featureQueueBatchStatusValues,
);
export const featureQueueItemStatus = pgEnum(
	"feature_queue_item_status",
	featureQueueItemStatusValues,
);
export const featureQueueItemComplexity = pgEnum(
	"feature_queue_item_complexity",
	featureQueueItemComplexityValues,
);

// Tables
export const featureRequests = pgTable(
	"feature_requests",
	{
		id: uuid().primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		title: varchar({ length: 200 }).notNull(),
		summary: text(),
		rawPrompt: text("raw_prompt").notNull(),
		status: featureRequestStatus().notNull().default("draft"),
		rulesetReference: text("ruleset_reference"),
		currentRunId: uuid("current_run_id"),
		createdById: uuid("created_by_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("feature_requests_org_idx").on(table.organizationId),
		index("feature_requests_status_idx").on(table.status),
		index("feature_requests_created_by_idx").on(table.createdById),
		index("feature_requests_created_at_idx").on(table.createdAt),
	],
);

export type InsertFeatureRequest = typeof featureRequests.$inferInsert;
export type SelectFeatureRequest = typeof featureRequests.$inferSelect;

export const featureRequestMessages = pgTable(
	"feature_request_messages",
	{
		id: uuid().primaryKey().defaultRandom(),
		featureRequestId: uuid("feature_request_id")
			.notNull()
			.references(() => featureRequests.id, { onDelete: "cascade" }),
		role: featureRequestMessageRole().notNull(),
		kind: featureRequestMessageKind().notNull().default("conversation"),
		content: text().notNull(),
		metadata: jsonb().$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("feature_request_messages_request_idx").on(table.featureRequestId),
	],
);

export type InsertFeatureRequestMessage =
	typeof featureRequestMessages.$inferInsert;
export type SelectFeatureRequestMessage =
	typeof featureRequestMessages.$inferSelect;

export const featureRequestArtifacts = pgTable(
	"feature_request_artifacts",
	{
		id: uuid().primaryKey().defaultRandom(),
		featureRequestId: uuid("feature_request_id")
			.notNull()
			.references(() => featureRequests.id, { onDelete: "cascade" }),
		kind: featureArtifactKind().notNull(),
		version: integer().notNull().default(1),
		content: text().notNull(),
		metadata: jsonb().$type<Record<string, unknown>>(),
		createdById: uuid("created_by_id").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("feature_request_artifacts_request_idx").on(table.featureRequestId),
	],
);

export type InsertFeatureRequestArtifact =
	typeof featureRequestArtifacts.$inferInsert;
export type SelectFeatureRequestArtifact =
	typeof featureRequestArtifacts.$inferSelect;

export const featureRequestApprovals = pgTable(
	"feature_request_approvals",
	{
		id: uuid().primaryKey().defaultRandom(),
		featureRequestId: uuid("feature_request_id")
			.notNull()
			.references(() => featureRequests.id, { onDelete: "cascade" }),
		approvalType: featureApprovalType("approval_type").notNull(),
		status: featureApprovalStatus().notNull().default("pending"),
		requestedFromId: uuid("requested_from_id").references(() => users.id, {
			onDelete: "set null",
		}),
		decidedById: uuid("decided_by_id").references(() => users.id, {
			onDelete: "set null",
		}),
		decisionNotes: text("decision_notes"),
		approvedArtifactVersion: integer("approved_artifact_version"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("feature_request_approvals_request_idx").on(table.featureRequestId),
		index("feature_request_approvals_status_idx").on(table.status),
	],
);

export type InsertFeatureRequestApproval =
	typeof featureRequestApprovals.$inferInsert;
export type SelectFeatureRequestApproval =
	typeof featureRequestApprovals.$inferSelect;

export const featureRequestRuns = pgTable(
	"feature_request_runs",
	{
		id: uuid().primaryKey().defaultRandom(),
		featureRequestId: uuid("feature_request_id")
			.notNull()
			.references(() => featureRequests.id, { onDelete: "cascade" }),
		workflowName: varchar("workflow_name", { length: 100 }).notNull(),
		workflowStep: varchar("workflow_step", { length: 100 }).notNull(),
		status: featureRunStatus().notNull().default("queued"),
		resumeToken: text("resume_token"),
		lastError: text("last_error"),
		retryCount: integer("retry_count").notNull().default(0),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("feature_request_runs_request_idx").on(table.featureRequestId),
		index("feature_request_runs_status_idx").on(table.status),
	],
);

export type InsertFeatureRequestRun = typeof featureRequestRuns.$inferInsert;
export type SelectFeatureRequestRun = typeof featureRequestRuns.$inferSelect;

export const featureRequestWorktrees = pgTable(
	"feature_request_worktrees",
	{
		id: uuid().primaryKey().defaultRandom(),
		featureRequestId: uuid("feature_request_id")
			.notNull()
			.references(() => featureRequests.id, { onDelete: "cascade" }),
		worktreePath: text("worktree_path").notNull(),
		branchName: varchar("branch_name", { length: 255 }).notNull(),
		baseBranch: varchar("base_branch", { length: 255 }).notNull(),
		headCommitSha: varchar("head_commit_sha", { length: 64 }),
		lastVerifiedCommitSha: varchar("last_verified_commit_sha", { length: 64 }),
		previewUrl: text("preview_url"),
		previewProvider: varchar("preview_provider", { length: 50 }),
		previewCommitSha: varchar("preview_commit_sha", { length: 64 }),
		previewStatus: varchar("preview_status", { length: 50 }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("feature_request_worktrees_request_idx").on(table.featureRequestId),
	],
);

export type InsertFeatureRequestWorktree =
	typeof featureRequestWorktrees.$inferInsert;
export type SelectFeatureRequestWorktree =
	typeof featureRequestWorktrees.$inferSelect;

export const featureRegistrations = pgTable(
	"feature_registrations",
	{
		id: uuid().primaryKey().defaultRandom(),
		featureRequestId: uuid("feature_request_id")
			.notNull()
			.references(() => featureRequests.id, { onDelete: "cascade" }),
		featureKey: varchar("feature_key", { length: 200 }).notNull(),
		registryVersion: integer("registry_version").notNull().default(1),
		status: featureRegistrationStatus().notNull().default("pending"),
		registeredById: uuid("registered_by_id").references(() => users.id, {
			onDelete: "set null",
		}),
		registeredCommitSha: varchar("registered_commit_sha", { length: 64 }),
		registrationMetadata: jsonb("registration_metadata").$type<
			Record<string, unknown>
		>(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("feature_registrations_request_idx").on(table.featureRequestId),
		index("feature_registrations_status_idx").on(table.status),
	],
);

export type InsertFeatureRegistration =
	typeof featureRegistrations.$inferInsert;
export type SelectFeatureRegistration =
	typeof featureRegistrations.$inferSelect;

// Feature Queue tables
export const featureQueueBatches = pgTable(
	"feature_queue_batches",
	{
		id: uuid().primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		createdById: uuid("created_by_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		title: varchar({ length: 300 }),
		status: featureQueueBatchStatus().notNull().default("pending"),
		concurrencyLimit: integer("concurrency_limit").notNull().default(1),
		totalItems: integer("total_items").notNull().default(0),
		completedItems: integer("completed_items").notNull().default(0),
		failedItems: integer("failed_items").notNull().default(0),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("feature_queue_batches_created_by_idx").on(table.createdById),
		index("feature_queue_batches_status_idx").on(table.status),
		index("feature_queue_batches_created_at_idx").on(table.createdAt),
	],
);

export type InsertFeatureQueueBatch = typeof featureQueueBatches.$inferInsert;
export type SelectFeatureQueueBatch = typeof featureQueueBatches.$inferSelect;

export const featureQueueItems = pgTable(
	"feature_queue_items",
	{
		id: uuid().primaryKey().defaultRandom(),
		batchId: uuid("batch_id")
			.notNull()
			.references(() => featureQueueBatches.id, { onDelete: "cascade" }),
		featureRequestId: uuid("feature_request_id").references(
			() => featureRequests.id,
			{ onDelete: "set null" },
		),
		position: integer().notNull(),
		status: featureQueueItemStatus().notNull().default("pending"),
		rawPrompt: text("raw_prompt").notNull(),
		title: varchar({ length: 200 }),
		estimatedComplexity: featureQueueItemComplexity("estimated_complexity")
			.notNull()
			.default("medium"),
		sessionId: varchar("session_id", { length: 255 }),
		resumeToken: text("resume_token"),
		retryCount: integer("retry_count").notNull().default(0),
		maxRetries: integer("max_retries").notNull().default(3),
		lastError: text("last_error"),
		metadata: jsonb().$type<Record<string, unknown>>(),
		startedAt: timestamp("started_at"),
		completedAt: timestamp("completed_at"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("feature_queue_items_batch_idx").on(table.batchId),
		index("feature_queue_items_status_idx").on(table.status),
		index("feature_queue_items_session_idx").on(table.sessionId),
		index("feature_queue_items_processing_idx").on(
			table.status,
			table.position,
		),
	],
);

export type InsertFeatureQueueItem = typeof featureQueueItems.$inferInsert;
export type SelectFeatureQueueItem = typeof featureQueueItems.$inferSelect;
