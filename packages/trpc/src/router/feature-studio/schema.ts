import { featureRequestStatusEnum } from "@superset/db/enums";
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
