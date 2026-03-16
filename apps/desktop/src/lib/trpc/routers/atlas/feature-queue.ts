import type { AppRouter } from "@superset/trpc";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { env } from "main/env.main";
import superjson from "superjson";
import { z } from "zod";
import { publicProcedure, router } from "../..";
import { loadToken } from "../auth/utils/auth-functions";

async function getAuthHeaders(): Promise<Record<string, string>> {
	const { token } = await loadToken();
	if (!token) {
		return {};
	}
	return { Authorization: `Bearer ${token}` };
}

const apiClient = createTRPCProxyClient<AppRouter>({
	links: [
		httpBatchLink({
			url: `${env.NEXT_PUBLIC_API_URL}/api/trpc`,
			transformer: superjson,
			headers: getAuthHeaders,
		}),
	],
});

const batchStatusEnum = z.enum([
	"pending",
	"processing",
	"completed",
	"partial_failed",
	"failed",
	"cancelled",
]);

const itemStatusEnum = z.enum([
	"pending",
	"waiting_deps",
	"processing",
	"paused",
	"completed",
	"failed",
	"cancelled",
]);

const complexityEnum = z.enum(["light", "medium", "heavy"]);

export const createAtlasFeatureQueueRouter = () =>
	router({
		submitBatch: publicProcedure
			.input(
				z.object({
					title: z.string().max(300).optional(),
					items: z
						.array(
							z.object({
								rawPrompt: z.string().min(1),
								title: z.string().max(200).optional(),
								estimatedComplexity: complexityEnum.optional(),
							}),
						)
						.min(1)
						.max(20),
					concurrencyLimit: z.number().int().min(1).max(5).optional(),
				}),
			)
			.mutation(async ({ input }) => {
				return apiClient.featureQueue.submitBatch.mutate(input);
			}),

		getBatch: publicProcedure
			.input(z.object({ batchId: z.string().uuid() }))
			.query(async ({ input }) => {
				return apiClient.featureQueue.getBatch.query(input);
			}),

		listBatches: publicProcedure
			.input(
				z
					.object({
						status: batchStatusEnum.optional(),
						limit: z.number().int().min(1).max(100).default(20),
						offset: z.number().int().min(0).default(0),
					})
					.optional(),
			)
			.query(async ({ input }) => {
				return apiClient.featureQueue.listBatches.query(input);
			}),

		nextItems: publicProcedure
			.input(z.object({ batchId: z.string().uuid() }))
			.query(async ({ input }) => {
				return apiClient.featureQueue.nextItems.query(input);
			}),

		updateItemStatus: publicProcedure
			.input(
				z.object({
					itemId: z.string().uuid(),
					status: itemStatusEnum,
					sessionId: z.string().max(255).optional(),
					resumeToken: z.string().optional(),
					featureRequestId: z.string().uuid().optional(),
					lastError: z.string().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				return apiClient.featureQueue.updateItemStatus.mutate(input);
			}),

		resumeItem: publicProcedure
			.input(
				z.object({
					itemId: z.string().uuid(),
					sessionId: z.string().max(255),
				}),
			)
			.query(async ({ input }) => {
				return apiClient.featureQueue.resumeItem.query(input);
			}),

		cancelBatch: publicProcedure
			.input(z.object({ batchId: z.string().uuid() }))
			.mutation(async ({ input }) => {
				return apiClient.featureQueue.cancelBatch.mutate(input);
			}),

		cancelItem: publicProcedure
			.input(z.object({ itemId: z.string().uuid() }))
			.mutation(async ({ input }) => {
				return apiClient.featureQueue.cancelItem.mutate(input);
			}),
	});

export type AtlasFeatureQueueRouter = ReturnType<
	typeof createAtlasFeatureQueueRouter
>;
