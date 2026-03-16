import {
	featureQueueBatchStatusEnum,
	featureQueueItemComplexityEnum,
	featureQueueItemStatusEnum,
} from "@superset/db/enums";
import { z } from "zod";

export const queueItemInputSchema = z.object({
	rawPrompt: z.string().min(1),
	title: z.string().max(200).optional(),
	estimatedComplexity: featureQueueItemComplexityEnum.optional(),
});

export const submitBatchSchema = z.object({
	title: z.string().max(300).optional(),
	items: z.array(queueItemInputSchema).min(1).max(20),
	concurrencyLimit: z.number().int().min(1).max(5).optional(),
});

export const listBatchesSchema = z
	.object({
		status: featureQueueBatchStatusEnum.optional(),
		limit: z.number().int().min(1).max(100).default(20),
		offset: z.number().int().min(0).default(0),
	})
	.optional();

export const updateItemStatusSchema = z.object({
	itemId: z.string().uuid(),
	status: featureQueueItemStatusEnum,
	sessionId: z.string().max(255).optional(),
	resumeToken: z.string().optional(),
	featureRequestId: z.string().uuid().optional(),
	lastError: z.string().optional(),
});

export const resumeItemSchema = z.object({
	itemId: z.string().uuid(),
	sessionId: z.string().max(255),
});

export const cancelBatchSchema = z.object({
	batchId: z.string().uuid(),
});

export const cancelItemSchema = z.object({
	itemId: z.string().uuid(),
});
