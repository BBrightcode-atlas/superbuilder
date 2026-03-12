import { db } from "@superset/db/client";
import {
	featureRequestApprovals,
	featureRequestArtifacts,
	featureRequestMessages,
	featureRequests,
	featureRequestWorktrees,
} from "@superset/db/schema";
import { TRPCError } from "@trpc/server";
import type { TRPCRouterRecord } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import {
	createFeatureRequestSchema,
	listQueueSchema,
	respondToApprovalSchema,
} from "./schema";

export const featureStudioRouter = {
	createRequest: protectedProcedure
		.input(createFeatureRequestSchema)
		.mutation(async ({ ctx, input }) => {
			const [created] = await db
				.insert(featureRequests)
				.values({
					title: input.title,
					rawPrompt: input.rawPrompt,
					summary: input.summary ?? null,
					rulesetReference: input.rulesetReference ?? null,
					createdById: ctx.session.user.id,
					organizationId: ctx.session.session.activeOrganizationId!,
				})
				.returning();

			if (!created) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create feature request",
				});
			}

			return created;
		}),

	getRequest: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			const request = await db.query.featureRequests.findFirst({
				where: eq(featureRequests.id, input.id),
				with: {
					messages: {
						orderBy: [desc(featureRequestMessages.createdAt)],
					},
					approvals: {
						orderBy: [desc(featureRequestApprovals.createdAt)],
					},
					artifacts: {
						orderBy: [desc(featureRequestArtifacts.createdAt)],
					},
					worktrees: {
						orderBy: [desc(featureRequestWorktrees.createdAt)],
					},
				},
			});

			if (!request) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Feature request not found: ${input.id}`,
				});
			}

			return request;
		}),

	listQueue: protectedProcedure
		.input(listQueueSchema)
		.query(async ({ ctx, input }) => {
			const orgId = ctx.session.session.activeOrganizationId!;

			const [requests, approvals] = await Promise.all([
				db.query.featureRequests.findMany({
					where: and(
						eq(featureRequests.organizationId, orgId),
						input?.status
							? eq(featureRequests.status, input.status)
							: undefined,
					),
					orderBy: [desc(featureRequests.createdAt)],
				}),
				db.query.featureRequestApprovals.findMany({
					orderBy: [desc(featureRequestApprovals.createdAt)],
				}),
			]);

			return {
				requests,
				pendingApprovals: approvals.filter((a) => a.status === "pending"),
			};
		}),

	listReadyToRegister: protectedProcedure.query(async ({ ctx }) => {
		const orgId = ctx.session.session.activeOrganizationId!;

		return db.query.featureRequests.findMany({
			where: and(
				eq(featureRequests.organizationId, orgId),
				eq(featureRequests.status, "pending_registration"),
			),
			orderBy: [desc(featureRequests.createdAt)],
		});
	}),

	advance: protectedProcedure
		.input(z.object({ featureRequestId: z.string().uuid() }))
		.mutation(async ({ input }) => {
			const request = await db.query.featureRequests.findFirst({
				where: eq(featureRequests.id, input.featureRequestId),
			});

			if (!request) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Feature request not found: ${input.featureRequestId}`,
				});
			}

			// TODO: Implement state machine advance logic
			return request;
		}),

	respondToApproval: protectedProcedure
		.input(respondToApprovalSchema)
		.mutation(async ({ ctx, input }) => {
			const approval = await db.query.featureRequestApprovals.findFirst({
				where: eq(featureRequestApprovals.id, input.approvalId),
			});

			if (!approval) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Approval not found: ${input.approvalId}`,
				});
			}

			const [updated] = await db
				.update(featureRequestApprovals)
				.set({
					status: input.action,
					decisionNotes: input.feedback ?? null,
					decidedById: ctx.session.user.id,
				})
				.where(eq(featureRequestApprovals.id, input.approvalId))
				.returning();

			if (!updated) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update approval",
				});
			}

			// Save human QA notes as artifact if feedback provided
			if (
				approval.approvalType === "human_qa" &&
				input.feedback?.trim()
			) {
				await db.insert(featureRequestArtifacts).values({
					featureRequestId: approval.featureRequestId,
					kind: "human_qa_notes",
					version: 1,
					content: input.feedback.trim(),
					metadata: {
						approvalId: approval.id,
						action: input.action,
					},
					createdById: ctx.session.user.id,
				});
			}

			// Resolve next status based on approval type and action
			let nextStatus: (typeof featureRequests.$inferSelect)["status"] | null =
				null;
			if (input.action === "discarded") {
				nextStatus = "discarded";
			} else if (
				input.action === "rejected" &&
				(approval.approvalType === "human_qa" ||
					approval.approvalType === "registration")
			) {
				nextStatus = "customization";
			}

			if (nextStatus) {
				await db
					.update(featureRequests)
					.set({ status: nextStatus })
					.where(eq(featureRequests.id, approval.featureRequestId));
			}

			return updated;
		}),

	requestRegistrationApproval: protectedProcedure
		.input(z.object({ featureRequestId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const request = await db.query.featureRequests.findFirst({
				where: eq(featureRequests.id, input.featureRequestId),
			});

			if (!request) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Feature request not found: ${input.featureRequestId}`,
				});
			}

			const [approval] = await db
				.insert(featureRequestApprovals)
				.values({
					featureRequestId: input.featureRequestId,
					approvalType: "registration",
					status: "pending",
					requestedFromId: ctx.session.user.id,
				})
				.returning();

			await db
				.update(featureRequests)
				.set({ status: "pending_registration" })
				.where(eq(featureRequests.id, input.featureRequestId));

			return approval;
		}),

	registerRequest: protectedProcedure
		.input(z.object({ featureRequestId: z.string().uuid() }))
		.mutation(async ({ input }) => {
			const request = await db.query.featureRequests.findFirst({
				where: eq(featureRequests.id, input.featureRequestId),
			});

			if (!request) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Feature request not found: ${input.featureRequestId}`,
				});
			}

			await db
				.update(featureRequests)
				.set({ status: "registered" })
				.where(eq(featureRequests.id, input.featureRequestId));

			return { success: true };
		}),
} satisfies TRPCRouterRecord;
