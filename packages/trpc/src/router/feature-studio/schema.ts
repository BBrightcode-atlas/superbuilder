import {
	featureArtifactKindEnum,
	featureRequestStatusEnum,
	featureRunStatusEnum,
} from "@superset/db/enums";
import { z } from "zod";

export const createFeatureRequestSchema = z.object({
	title: z.string().min(1).max(200),
	rawPrompt: z.string().min(1),
	summary: z.string().optional(),
	rulesetReference: z.string().optional(),
});

export const respondToApprovalSchema = z.object({
	approvalId: z.string().uuid(),
	action: z.enum(["approved", "rejected", "discarded"]),
	feedback: z.string().optional(),
});

export const listQueueSchema = z
	.object({
		status: featureRequestStatusEnum.optional(),
	})
	.optional();

// 메시지 추가 스키마
export const appendMessageSchema = z.object({
	featureRequestId: z.string().uuid(),
	role: z.enum(["system", "assistant", "user"]),
	content: z.string(),
	kind: z.enum(["conversation", "event", "note"]).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

// 아티팩트 저장 스키마
export const saveArtifactSchema = z.object({
	featureRequestId: z.string().uuid(),
	kind: featureArtifactKindEnum,
	content: z.string(),
	version: z.number().int().positive().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

// 상태 업데이트 스키마
export const updateStatusSchema = z.object({
	featureRequestId: z.string().uuid(),
	status: featureRequestStatusEnum,
	errorMessage: z.string().optional(),
});

// 워크트리 저장 스키마
export const saveWorktreeSchema = z.object({
	featureRequestId: z.string().uuid(),
	worktreePath: z.string(),
	branchName: z.string(),
	baseBranch: z.string().default("develop"),
});

// 런 생성 스키마
export const createRunSchema = z.object({
	featureRequestId: z.string().uuid(),
	workflowName: z.string(),
	workflowStep: z.string(),
});

// 런 업데이트 스키마
export const updateRunSchema = z.object({
	runId: z.string().uuid(),
	status: featureRunStatusEnum,
	lastError: z.string().optional(),
});
