import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { baseColumns } from "../../../utils";
import { profiles } from "../../core/profiles";

export const featureRequestStatusEnum = pgEnum("feature_request_status", [
  "draft",
  "spec_ready",
  "pending_spec_approval",
  "plan_approved",
  "implementing",
  "verifying",
  "preview_deploying",
  "agent_qa",
  "pending_human_qa",
  "customization",
  "pending_registration",
  "registered",
  "failed",
  "discarded",
]);

export const featureRequestMessageRoleEnum = pgEnum(
  "feature_request_message_role",
  ["system", "assistant", "user"],
);

export const featureRequestMessageKindEnum = pgEnum(
  "feature_request_message_kind",
  ["conversation", "event", "note"],
);

export const featureArtifactKindEnum = pgEnum("feature_artifact_kind", [
  "spec",
  "plan",
  "implementation_summary",
  "verification_report",
  "agent_qa_report",
  "human_qa_notes",
  "registration_manifest",
  "preview_metadata",
]);

export const featureApprovalTypeEnum = pgEnum("feature_approval_type", [
  "spec_plan",
  "human_qa",
  "registration",
]);

export const featureApprovalStatusEnum = pgEnum("feature_approval_status", [
  "pending",
  "approved",
  "rejected",
  "discarded",
]);

export const featureRunStatusEnum = pgEnum("feature_run_status", [
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);

export const featureRegistrationStatusEnum = pgEnum(
  "feature_registration_status",
  ["pending", "registered", "failed", "discarded"],
);

export const featureRequests = pgTable("feature_requests", {
  ...baseColumns(),
  title: varchar("title", { length: 200 }).notNull(),
  summary: text("summary"),
  rawPrompt: text("raw_prompt").notNull(),
  status: featureRequestStatusEnum("status").notNull().default("draft"),
  rulesetReference: text("ruleset_reference"),
  currentRunId: uuid("current_run_id"),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
});

export const featureRequestMessages = pgTable("feature_request_messages", {
  ...baseColumns(),
  featureRequestId: uuid("feature_request_id")
    .notNull()
    .references(() => featureRequests.id, { onDelete: "cascade" }),
  role: featureRequestMessageRoleEnum("role").notNull(),
  kind: featureRequestMessageKindEnum("kind").notNull().default("conversation"),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
});

export const featureRequestArtifacts = pgTable("feature_request_artifacts", {
  ...baseColumns(),
  featureRequestId: uuid("feature_request_id")
    .notNull()
    .references(() => featureRequests.id, { onDelete: "cascade" }),
  kind: featureArtifactKindEnum("kind").notNull(),
  version: integer("version").notNull().default(1),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdById: uuid("created_by_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
});

export const featureRequestApprovals = pgTable("feature_request_approvals", {
  ...baseColumns(),
  featureRequestId: uuid("feature_request_id")
    .notNull()
    .references(() => featureRequests.id, { onDelete: "cascade" }),
  approvalType: featureApprovalTypeEnum("approval_type").notNull(),
  status: featureApprovalStatusEnum("status").notNull().default("pending"),
  requestedFromId: uuid("requested_from_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  decidedById: uuid("decided_by_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  decisionNotes: text("decision_notes"),
  approvedArtifactVersion: integer("approved_artifact_version"),
});

export const featureRequestRuns = pgTable("feature_request_runs", {
  ...baseColumns(),
  featureRequestId: uuid("feature_request_id")
    .notNull()
    .references(() => featureRequests.id, { onDelete: "cascade" }),
  workflowName: varchar("workflow_name", { length: 100 }).notNull(),
  workflowStep: varchar("workflow_step", { length: 100 }).notNull(),
  status: featureRunStatusEnum("status").notNull().default("queued"),
  resumeToken: text("resume_token"),
  lastError: text("last_error"),
  retryCount: integer("retry_count").notNull().default(0),
});

export const featureRequestWorktrees = pgTable("feature_request_worktrees", {
  ...baseColumns(),
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
});

export const featureRegistrations = pgTable("feature_registrations", {
  ...baseColumns(),
  featureRequestId: uuid("feature_request_id")
    .notNull()
    .references(() => featureRequests.id, { onDelete: "cascade" }),
  featureKey: varchar("feature_key", { length: 200 }).notNull(),
  registryVersion: integer("registry_version").notNull().default(1),
  status: featureRegistrationStatusEnum("status").notNull().default("pending"),
  registeredById: uuid("registered_by_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  registeredCommitSha: varchar("registered_commit_sha", { length: 64 }),
  registrationMetadata: jsonb("registration_metadata"),
});

export const featureRequestsRelations = relations(
  featureRequests,
  ({ many, one }) => ({
    createdBy: one(profiles, {
      fields: [featureRequests.createdById],
      references: [profiles.id],
    }),
    messages: many(featureRequestMessages),
    artifacts: many(featureRequestArtifacts),
    approvals: many(featureRequestApprovals),
    runs: many(featureRequestRuns),
    worktrees: many(featureRequestWorktrees),
    registrations: many(featureRegistrations),
  }),
);

export const featureRequestMessagesRelations = relations(
  featureRequestMessages,
  ({ one }) => ({
    featureRequest: one(featureRequests, {
      fields: [featureRequestMessages.featureRequestId],
      references: [featureRequests.id],
    }),
  }),
);

export const featureRequestArtifactsRelations = relations(
  featureRequestArtifacts,
  ({ one }) => ({
    featureRequest: one(featureRequests, {
      fields: [featureRequestArtifacts.featureRequestId],
      references: [featureRequests.id],
    }),
    createdBy: one(profiles, {
      fields: [featureRequestArtifacts.createdById],
      references: [profiles.id],
    }),
  }),
);

export const featureRequestApprovalsRelations = relations(
  featureRequestApprovals,
  ({ one }) => ({
    featureRequest: one(featureRequests, {
      fields: [featureRequestApprovals.featureRequestId],
      references: [featureRequests.id],
    }),
    requestedFrom: one(profiles, {
      fields: [featureRequestApprovals.requestedFromId],
      references: [profiles.id],
    }),
    decidedBy: one(profiles, {
      fields: [featureRequestApprovals.decidedById],
      references: [profiles.id],
    }),
  }),
);

export const featureRequestRunsRelations = relations(
  featureRequestRuns,
  ({ one }) => ({
    featureRequest: one(featureRequests, {
      fields: [featureRequestRuns.featureRequestId],
      references: [featureRequests.id],
    }),
  }),
);

export const featureRequestWorktreesRelations = relations(
  featureRequestWorktrees,
  ({ one }) => ({
    featureRequest: one(featureRequests, {
      fields: [featureRequestWorktrees.featureRequestId],
      references: [featureRequests.id],
    }),
  }),
);

export const featureRegistrationsRelations = relations(
  featureRegistrations,
  ({ one }) => ({
    featureRequest: one(featureRequests, {
      fields: [featureRegistrations.featureRequestId],
      references: [featureRequests.id],
    }),
    registeredBy: one(profiles, {
      fields: [featureRegistrations.registeredById],
      references: [profiles.id],
    }),
  }),
);

export type FeatureRequest = typeof featureRequests.$inferSelect;
export type NewFeatureRequest = typeof featureRequests.$inferInsert;
export type FeatureRequestMessage = typeof featureRequestMessages.$inferSelect;
export type NewFeatureRequestMessage = typeof featureRequestMessages.$inferInsert;
export type FeatureRequestArtifact = typeof featureRequestArtifacts.$inferSelect;
export type NewFeatureRequestArtifact = typeof featureRequestArtifacts.$inferInsert;
export type FeatureRequestApproval = typeof featureRequestApprovals.$inferSelect;
export type NewFeatureRequestApproval =
  typeof featureRequestApprovals.$inferInsert;
export type FeatureRequestRun = typeof featureRequestRuns.$inferSelect;
export type NewFeatureRequestRun = typeof featureRequestRuns.$inferInsert;
export type FeatureRequestWorktree = typeof featureRequestWorktrees.$inferSelect;
export type NewFeatureRequestWorktree =
  typeof featureRequestWorktrees.$inferInsert;
export type FeatureRegistration = typeof featureRegistrations.$inferSelect;
export type NewFeatureRegistration = typeof featureRegistrations.$inferInsert;
