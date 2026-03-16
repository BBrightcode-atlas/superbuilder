import { db } from "@superset/db/client";
import { featureQueueBatches, featureQueueItems } from "@superset/db/schema";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import {
	cancelBatchSchema,
	cancelItemSchema,
	listBatchesSchema,
	resumeItemSchema,
	submitBatchSchema,
	updateItemStatusSchema,
} from "./schema";

export const featureQueueRouter = {
	submitBatch: protectedProcedure
		.input(submitBatchSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const orgId = ctx.session.session.activeOrganizationId!;

			// Auto-calculate concurrency: all light items → concurrency = count, otherwise use input or default 1
			const allLight = input.items.every(
				(i) => (i.estimatedComplexity ?? "medium") === "light",
			);
			const concurrencyLimit =
				input.concurrencyLimit ?? (allLight ? input.items.length : 1);

			const [batch] = await db
				.insert(featureQueueBatches)
				.values({
					organizationId: orgId,
					createdById: userId,
					title:
						input.title ??
						input.items
							.map((i) => i.title ?? i.rawPrompt.slice(0, 30))
							.join(", "),
					concurrencyLimit,
					totalItems: input.items.length,
				})
				.returning();

			if (!batch) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create queue batch",
				});
			}

			const itemValues = input.items.map((item, idx) => ({
				batchId: batch.id,
				position: idx + 1,
				rawPrompt: item.rawPrompt,
				title: item.title ?? null,
				estimatedComplexity: item.estimatedComplexity ?? ("medium" as const),
			}));

			const items = await db
				.insert(featureQueueItems)
				.values(itemValues)
				.returning();

			return { batch, items };
		}),

	getBatch: protectedProcedure
		.input(z.object({ batchId: z.string().uuid() }))
		.query(async ({ input }) => {
			const batch = await db.query.featureQueueBatches.findFirst({
				where: eq(featureQueueBatches.id, input.batchId),
				with: {
					items: {
						orderBy: [asc(featureQueueItems.position)],
					},
				},
			});

			if (!batch) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Batch not found: ${input.batchId}`,
				});
			}

			return batch;
		}),

	listBatches: protectedProcedure
		.input(listBatchesSchema)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const batches = await db.query.featureQueueBatches.findMany({
				where: and(
					eq(featureQueueBatches.createdById, userId),
					input?.status
						? eq(featureQueueBatches.status, input.status)
						: undefined,
				),
				with: {
					items: {
						orderBy: [asc(featureQueueItems.position)],
					},
				},
				orderBy: [desc(featureQueueBatches.createdAt)],
				limit: input?.limit ?? 20,
				offset: input?.offset ?? 0,
			});

			return batches;
		}),

	nextItems: protectedProcedure
		.input(z.object({ batchId: z.string().uuid() }))
		.query(async ({ input }) => {
			const batch = await db.query.featureQueueBatches.findFirst({
				where: eq(featureQueueBatches.id, input.batchId),
			});

			if (!batch) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Batch not found: ${input.batchId}`,
				});
			}

			// Count currently processing items
			const [processingCount] = await db
				.select({ count: count() })
				.from(featureQueueItems)
				.where(
					and(
						eq(featureQueueItems.batchId, input.batchId),
						eq(featureQueueItems.status, "processing"),
					),
				);

			const slots = batch.concurrencyLimit - (processingCount?.count ?? 0);
			if (slots <= 0) return [];

			// Get next pending items respecting concurrency
			const pendingItems = await db.query.featureQueueItems.findMany({
				where: and(
					eq(featureQueueItems.batchId, input.batchId),
					eq(featureQueueItems.status, "pending"),
				),
				orderBy: [asc(featureQueueItems.position)],
				limit: slots,
			});

			return pendingItems;
		}),

	updateItemStatus: protectedProcedure
		.input(updateItemStatusSchema)
		.mutation(async ({ input }) => {
			const updates: Record<string, unknown> = {
				status: input.status,
			};

			if (input.sessionId !== undefined) updates.sessionId = input.sessionId;
			if (input.resumeToken !== undefined)
				updates.resumeToken = input.resumeToken;
			if (input.featureRequestId !== undefined)
				updates.featureRequestId = input.featureRequestId;
			if (input.lastError !== undefined) updates.lastError = input.lastError;

			if (input.status === "processing") {
				updates.startedAt = new Date();
			} else if (
				input.status === "completed" ||
				input.status === "failed" ||
				input.status === "cancelled"
			) {
				updates.completedAt = new Date();
			}

			const [updated] = await db
				.update(featureQueueItems)
				.set(updates)
				.where(eq(featureQueueItems.id, input.itemId))
				.returning();

			if (!updated) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Queue item not found: ${input.itemId}`,
				});
			}

			// Sync batch counters
			await syncBatchCounters(updated.batchId);

			return updated;
		}),

	resumeItem: protectedProcedure
		.input(resumeItemSchema)
		.query(async ({ input }) => {
			const item = await db.query.featureQueueItems.findFirst({
				where: and(
					eq(featureQueueItems.id, input.itemId),
					eq(featureQueueItems.sessionId, input.sessionId),
				),
			});

			if (!item) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Queue item not found or session mismatch: ${input.itemId}`,
				});
			}

			return {
				item,
				resumeToken: item.resumeToken,
				featureRequestId: item.featureRequestId,
			};
		}),

	cancelBatch: protectedProcedure
		.input(cancelBatchSchema)
		.mutation(async ({ input }) => {
			// Cancel all pending/processing items
			await db
				.update(featureQueueItems)
				.set({ status: "cancelled", completedAt: new Date() })
				.where(
					and(
						eq(featureQueueItems.batchId, input.batchId),
						inArray(featureQueueItems.status, ["pending", "waiting_deps"]),
					),
				);

			const [updated] = await db
				.update(featureQueueBatches)
				.set({ status: "cancelled" })
				.where(eq(featureQueueBatches.id, input.batchId))
				.returning();

			if (!updated) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Batch not found: ${input.batchId}`,
				});
			}

			return updated;
		}),

	cancelItem: protectedProcedure
		.input(cancelItemSchema)
		.mutation(async ({ input }) => {
			const [updated] = await db
				.update(featureQueueItems)
				.set({ status: "cancelled", completedAt: new Date() })
				.where(eq(featureQueueItems.id, input.itemId))
				.returning();

			if (!updated) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Queue item not found: ${input.itemId}`,
				});
			}

			await syncBatchCounters(updated.batchId);

			return updated;
		}),
} satisfies TRPCRouterRecord;

async function syncBatchCounters(batchId: string) {
	const [completed] = await db
		.select({ count: count() })
		.from(featureQueueItems)
		.where(
			and(
				eq(featureQueueItems.batchId, batchId),
				eq(featureQueueItems.status, "completed"),
			),
		);

	const [failed] = await db
		.select({ count: count() })
		.from(featureQueueItems)
		.where(
			and(
				eq(featureQueueItems.batchId, batchId),
				inArray(featureQueueItems.status, ["failed", "cancelled"]),
			),
		);

	const batch = await db.query.featureQueueBatches.findFirst({
		where: eq(featureQueueBatches.id, batchId),
	});

	if (!batch) return;

	const completedCount = completed?.count ?? 0;
	const failedCount = failed?.count ?? 0;
	const total = batch.totalItems;

	let batchStatus = batch.status;
	if (completedCount + failedCount >= total) {
		if (failedCount === 0) {
			batchStatus = "completed";
		} else if (completedCount === 0) {
			batchStatus = "failed";
		} else {
			batchStatus = "partial_failed";
		}
	} else if (completedCount > 0 || failedCount > 0) {
		batchStatus = "processing";
	}

	await db
		.update(featureQueueBatches)
		.set({
			completedItems: completedCount,
			failedItems: failedCount,
			status: batchStatus,
		})
		.where(eq(featureQueueBatches.id, batchId));
}
