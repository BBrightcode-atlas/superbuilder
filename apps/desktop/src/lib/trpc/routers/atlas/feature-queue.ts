import { EventEmitter } from "node:events";
import {
	processQueue,
	type QueueApi,
	type QueueProcessorCallbacks,
	type UpdateItemResult,
} from "@superbuilder/atlas-engine";
import type { AppRouter } from "@superset/trpc";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
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

// ── Progress event bus ──────────────────────────────────────
type QueueProgressEvent = {
	type:
		| "item_start"
		| "item_complete"
		| "item_error"
		| "step"
		| "batch_complete";
	batchId: string;
	itemId?: string;
	message?: string;
	data?: Record<string, unknown>;
};

const queueEvents = new EventEmitter();
queueEvents.setMaxListeners(50);

// Active processing sessions to prevent double-starts
const activeProcessing = new Set<string>();

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

		startProcessing: publicProcedure
			.input(
				z.object({
					batchId: z.string().uuid(),
					featuresRepoPath: z.string(),
					sessionId: z.string().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				if (activeProcessing.has(input.batchId)) {
					return { started: false, reason: "already_processing" };
				}

				activeProcessing.add(input.batchId);

				const queueApi: QueueApi = {
					getBatch: (batchId) =>
						apiClient.featureQueue.getBatch.query({ batchId }),
					nextItems: (batchId) =>
						apiClient.featureQueue.nextItems.query({ batchId }),
					updateItemStatus: (params) =>
						apiClient.featureQueue.updateItemStatus.mutate(
							params as Parameters<
								typeof apiClient.featureQueue.updateItemStatus.mutate
							>[0],
						) as unknown as Promise<UpdateItemResult | undefined>,
				};

				const callbacks: QueueProcessorCallbacks = {
					onItemStart: (item, index, total) => {
						queueEvents.emit("progress", {
							type: "item_start",
							batchId: input.batchId,
							itemId: item.id,
							message: `[${index + 1}/${total}] 시작: ${item.title ?? item.rawPrompt.slice(0, 50)}`,
						} satisfies QueueProgressEvent);
					},
					onItemComplete: (item, result, index, total) => {
						queueEvents.emit("progress", {
							type: "item_complete",
							batchId: input.batchId,
							itemId: item.id,
							message: `[${index + 1}/${total}] 완료: ${result.featureName}`,
							data: { prUrl: result.prUrl },
						} satisfies QueueProgressEvent);
					},
					onItemError: (item, error, index, total) => {
						queueEvents.emit("progress", {
							type: "item_error",
							batchId: input.batchId,
							itemId: item.id,
							message: `[${index + 1}/${total}] 실패: ${error}`,
						} satisfies QueueProgressEvent);
					},
					onStep: (step, status, message) => {
						queueEvents.emit("progress", {
							type: "step",
							batchId: input.batchId,
							message: `[${step}] ${status}: ${message ?? ""}`,
						} satisfies QueueProgressEvent);
					},
					onBatchComplete: (batchId, results) => {
						queueEvents.emit("progress", {
							type: "batch_complete",
							batchId,
							message: `배치 완료 (${results.size}건 처리)`,
						} satisfies QueueProgressEvent);
						activeProcessing.delete(batchId);
					},
				};

				// Fire-and-forget: 백그라운드에서 처리
				processQueue({
					batchId: input.batchId,
					featuresRepoPath: input.featuresRepoPath,
					api: queueApi,
					callbacks,
					sessionId: input.sessionId,
				}).catch((err) => {
					queueEvents.emit("progress", {
						type: "batch_complete",
						batchId: input.batchId,
						message: `배치 실패: ${err instanceof Error ? err.message : String(err)}`,
					} satisfies QueueProgressEvent);
					activeProcessing.delete(input.batchId);
				});

				return { started: true };
			}),

		onProgress: publicProcedure
			.input(z.object({ batchId: z.string().uuid() }))
			.subscription(({ input }) => {
				return observable<QueueProgressEvent>((emit) => {
					const handler = (event: QueueProgressEvent) => {
						if (event.batchId === input.batchId) {
							emit.next(event);
						}
					};
					queueEvents.on("progress", handler);
					return () => {
						queueEvents.off("progress", handler);
					};
				});
			}),
	});

export type AtlasFeatureQueueRouter = ReturnType<
	typeof createAtlasFeatureQueueRouter
>;
