import { db } from "@superset/db/client";
import {
	featureRequestApprovals,
	featureRequestArtifacts,
	featureRequestMessages,
	featureRequestRuns,
	featureRequests,
	featureRequestWorktrees,
} from "@superset/db/schema";
import { TRPCError } from "@trpc/server";
import type { TRPCRouterRecord } from "@trpc/server";
import { and, desc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import {
	appendMessageSchema,
	createFeatureRequestSchema,
	createRunSchema,
	listQueueSchema,
	respondToApprovalSchema,
	saveArtifactSchema,
	saveWorktreeSchema,
	updateRunSchema,
	updateStatusSchema,
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

			// 상태 머신 전이 테이블
			const STATE_TRANSITIONS: Partial<
				Record<
					(typeof featureRequests.$inferSelect)["status"],
					(typeof featureRequests.$inferSelect)["status"]
				>
			> = {
				draft: "spec_ready",
				spec_ready: "pending_spec_approval",
				pending_spec_approval: "plan_approved",
				plan_approved: "implementing",
				implementing: "verifying",
				verifying: "pending_human_qa",
				pending_human_qa: "pending_registration",
				pending_registration: "registered",
				customization: "implementing",
			};

			const nextStatus = STATE_TRANSITIONS[request.status];

			if (!nextStatus) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `No valid transition from status: ${request.status}`,
				});
			}

			const [updated] = await db
				.update(featureRequests)
				.set({ status: nextStatus })
				.where(eq(featureRequests.id, input.featureRequestId))
				.returning();

			return updated;
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
	// 메시지를 featureRequestMessages에 추가
	appendMessage: protectedProcedure
		.input(appendMessageSchema)
		.mutation(async ({ input }) => {
			const [created] = await db
				.insert(featureRequestMessages)
				.values({
					featureRequestId: input.featureRequestId,
					role: input.role,
					content: input.content,
					kind: input.kind ?? "conversation",
					metadata: input.metadata ?? null,
				})
				.returning();

			if (!created) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to append message",
				});
			}

			return created;
		}),

	// 아티팩트를 저장 (버전 자동 증가)
	saveArtifact: protectedProcedure
		.input(saveArtifactSchema)
		.mutation(async ({ ctx, input }) => {
			// 동일 kind의 최신 버전 조회
			let nextVersion = 1;

			if (input.version === undefined) {
				const [latestVersionRow] = await db
					.select({ maxVersion: max(featureRequestArtifacts.version) })
					.from(featureRequestArtifacts)
					.where(
						and(
							eq(featureRequestArtifacts.featureRequestId, input.featureRequestId),
							eq(featureRequestArtifacts.kind, input.kind),
						),
					);

				if (latestVersionRow?.maxVersion != null) {
					nextVersion = latestVersionRow.maxVersion + 1;
				}
			} else {
				nextVersion = input.version;
			}

			const [created] = await db
				.insert(featureRequestArtifacts)
				.values({
					featureRequestId: input.featureRequestId,
					kind: input.kind,
					version: nextVersion,
					content: input.content,
					metadata: input.metadata ?? null,
					createdById: ctx.session.user.id,
				})
				.returning();

			if (!created) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to save artifact",
				});
			}

			return created;
		}),

	// 피처 요청 상태 업데이트 (에러 시 시스템 이벤트 메시지도 삽입)
	updateStatus: protectedProcedure
		.input(updateStatusSchema)
		.mutation(async ({ input }) => {
			const [updated] = await db
				.update(featureRequests)
				.set({ status: input.status })
				.where(eq(featureRequests.id, input.featureRequestId))
				.returning();

			if (!updated) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Feature request not found: ${input.featureRequestId}`,
				});
			}

			// 에러 메시지가 있으면 시스템 이벤트 메시지 삽입
			if (input.errorMessage) {
				await db.insert(featureRequestMessages).values({
					featureRequestId: input.featureRequestId,
					role: "system",
					kind: "event",
					content: input.errorMessage,
				});
			}

			return updated;
		}),

	// 워크트리 레코드 저장
	saveWorktree: protectedProcedure
		.input(saveWorktreeSchema)
		.mutation(async ({ input }) => {
			const [created] = await db
				.insert(featureRequestWorktrees)
				.values({
					featureRequestId: input.featureRequestId,
					worktreePath: input.worktreePath,
					branchName: input.branchName,
					baseBranch: input.baseBranch,
				})
				.returning();

			if (!created) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to save worktree",
				});
			}

			return created;
		}),

	// 새 런 생성 후 featureRequests.currentRunId 업데이트
	createRun: protectedProcedure
		.input(createRunSchema)
		.mutation(async ({ input }) => {
			const [run] = await db
				.insert(featureRequestRuns)
				.values({
					featureRequestId: input.featureRequestId,
					workflowName: input.workflowName,
					workflowStep: input.workflowStep,
					status: "queued",
				})
				.returning();

			if (!run) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create run",
				});
			}

			await db
				.update(featureRequests)
				.set({ currentRunId: run.id })
				.where(eq(featureRequests.id, input.featureRequestId));

			return run;
		}),

	// 런 상태 및 에러 업데이트
	updateRun: protectedProcedure
		.input(updateRunSchema)
		.mutation(async ({ input }) => {
			const [updated] = await db
				.update(featureRequestRuns)
				.set({
					status: input.status,
					lastError: input.lastError ?? null,
				})
				.where(eq(featureRequestRuns.id, input.runId))
				.returning();

			if (!updated) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Run not found: ${input.runId}`,
				});
			}

			return updated;
		}),
} satisfies TRPCRouterRecord;
