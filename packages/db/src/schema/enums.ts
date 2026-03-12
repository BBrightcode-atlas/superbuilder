import { z } from "zod";

export const taskStatusEnumValues = [
	"backlog",
	"todo",
	"planning",
	"working",
	"needs-feedback",
	"ready-to-merge",
	"completed",
	"canceled",
] as const;
export const taskStatusEnum = z.enum(taskStatusEnumValues);
export type TaskStatus = z.infer<typeof taskStatusEnum>;

export const taskPriorityValues = [
	"urgent",
	"high",
	"medium",
	"low",
	"none",
] as const;
export const taskPriorityEnum = z.enum(taskPriorityValues);
export type TaskPriority = z.infer<typeof taskPriorityEnum>;

export const integrationProviderValues = ["linear", "github", "slack"] as const;
export const integrationProviderEnum = z.enum(integrationProviderValues);
export type IntegrationProvider = z.infer<typeof integrationProviderEnum>;

export const deviceTypeValues = ["desktop", "mobile", "web"] as const;
export const deviceTypeEnum = z.enum(deviceTypeValues);
export type DeviceType = z.infer<typeof deviceTypeEnum>;

export const commandStatusValues = [
	"pending",
	"completed",
	"failed",
	"timeout",
] as const;
export const commandStatusEnum = z.enum(commandStatusValues);
export type CommandStatus = z.infer<typeof commandStatusEnum>;

export const sandboxStatusValues = [
	"pending",
	"spawning",
	"connecting",
	"warming",
	"syncing",
	"ready",
	"running",
	"stale",
	"snapshotting",
	"stopped",
	"failed",
] as const;
export const sandboxStatusEnum = z.enum(sandboxStatusValues);
export type SandboxStatus = z.infer<typeof sandboxStatusEnum>;

export const workspaceTypeValues = ["local", "cloud"] as const;
export const workspaceTypeEnum = z.enum(workspaceTypeValues);
export type WorkspaceType = z.infer<typeof workspaceTypeEnum>;

// Feature Studio enums
export const featureRequestStatusValues = [
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
] as const;
export const featureRequestStatusEnum = z.enum(featureRequestStatusValues);
export type FeatureRequestStatus = z.infer<typeof featureRequestStatusEnum>;

export const featureRequestMessageRoleValues = [
	"system",
	"assistant",
	"user",
] as const;
export const featureRequestMessageRoleEnum = z.enum(
	featureRequestMessageRoleValues,
);
export type FeatureRequestMessageRole = z.infer<
	typeof featureRequestMessageRoleEnum
>;

export const featureRequestMessageKindValues = [
	"conversation",
	"event",
	"note",
] as const;
export const featureRequestMessageKindEnum = z.enum(
	featureRequestMessageKindValues,
);
export type FeatureRequestMessageKind = z.infer<
	typeof featureRequestMessageKindEnum
>;

export const featureArtifactKindValues = [
	"spec",
	"plan",
	"implementation_summary",
	"verification_report",
	"agent_qa_report",
	"human_qa_notes",
	"registration_manifest",
	"preview_metadata",
] as const;
export const featureArtifactKindEnum = z.enum(featureArtifactKindValues);
export type FeatureArtifactKind = z.infer<typeof featureArtifactKindEnum>;

export const featureApprovalTypeValues = [
	"spec_plan",
	"human_qa",
	"registration",
] as const;
export const featureApprovalTypeEnum = z.enum(featureApprovalTypeValues);
export type FeatureApprovalType = z.infer<typeof featureApprovalTypeEnum>;

export const featureApprovalStatusValues = [
	"pending",
	"approved",
	"rejected",
	"discarded",
] as const;
export const featureApprovalStatusEnum = z.enum(featureApprovalStatusValues);
export type FeatureApprovalStatus = z.infer<typeof featureApprovalStatusEnum>;

export const featureRunStatusValues = [
	"queued",
	"running",
	"paused",
	"completed",
	"failed",
	"cancelled",
] as const;
export const featureRunStatusEnum = z.enum(featureRunStatusValues);
export type FeatureRunStatus = z.infer<typeof featureRunStatusEnum>;

export const featureRegistrationStatusValues = [
	"pending",
	"registered",
	"failed",
	"discarded",
] as const;
export const featureRegistrationStatusEnum = z.enum(
	featureRegistrationStatusValues,
);
export type FeatureRegistrationStatus = z.infer<
	typeof featureRegistrationStatusEnum
>;
