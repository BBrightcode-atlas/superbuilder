/**
 * Feature Queue E2E 테스트
 * DB에 직접 접근하여 queue 상태 관리를 검증한다.
 */
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { describe, expect, test } from "bun:test";
import { db } from "../client";
import {
	featureQueueBatches,
	featureQueueItems,
} from "../schema/feature-studio";

// ── helpers ─────────────────────────────────────────────────

async function createTestBatch(
	orgId: string,
	userId: string,
	items: Array<{
		rawPrompt: string;
		title: string;
		estimatedComplexity: "light" | "medium" | "heavy";
	}>,
) {
	const allLight = items.every((i) => i.estimatedComplexity === "light");
	const concurrencyLimit = allLight ? items.length : 1;

	const [batch] = await db
		.insert(featureQueueBatches)
		.values({
			organizationId: orgId,
			createdById: userId,
			title: items.map((i) => i.title).join(", "),
			concurrencyLimit,
			totalItems: items.length,
		})
		.returning();

	if (!batch) throw new Error("Failed to create batch");

	const itemValues = items.map((item, idx) => ({
		batchId: batch.id,
		position: idx + 1,
		rawPrompt: item.rawPrompt,
		title: item.title,
		estimatedComplexity: item.estimatedComplexity,
	}));

	const createdItems = await db
		.insert(featureQueueItems)
		.values(itemValues)
		.returning();

	return { batch, items: createdItems };
}

async function getNextItems(batchId: string) {
	const batch = await db.query.featureQueueBatches.findFirst({
		where: eq(featureQueueBatches.id, batchId),
	});
	if (!batch) return [];

	const [processingCount] = await db
		.select({ count: count() })
		.from(featureQueueItems)
		.where(
			and(
				eq(featureQueueItems.batchId, batchId),
				eq(featureQueueItems.status, "processing"),
			),
		);

	const slots = batch.concurrencyLimit - (processingCount?.count ?? 0);
	if (slots <= 0) return [];

	return db.query.featureQueueItems.findMany({
		where: and(
			eq(featureQueueItems.batchId, batchId),
			eq(featureQueueItems.status, "pending"),
		),
		orderBy: [asc(featureQueueItems.position)],
		limit: slots,
	});
}

async function updateItemStatus(
	itemId: string,
	status: string,
	extra?: { sessionId?: string; lastError?: string },
) {
	const updates: Record<string, unknown> = { status };
	if (extra?.sessionId) updates.sessionId = extra.sessionId;
	if (extra?.lastError) updates.lastError = extra.lastError;
	if (status === "processing") updates.startedAt = new Date();
	if (["completed", "failed", "cancelled"].includes(status))
		updates.completedAt = new Date();

	await db
		.update(featureQueueItems)
		.set(updates)
		.where(eq(featureQueueItems.id, itemId));
}

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
		batchStatus =
			failedCount === 0
				? "completed"
				: completedCount === 0
					? "failed"
					: "partial_failed";
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

async function getTestIds() {
	const org = await db.query.organizations.findFirst();
	const user = await db.query.users.findFirst();
	if (!org || !user) throw new Error("No org/user in DB — seed data required");
	return { orgId: org.id, userId: user.id };
}

// ── Tests ───────────────────────────────────────────────────

describe("Feature Queue E2E", () => {
	test("배치 생성 → 아이템 3개 등록", async () => {
		const { orgId, userId } = await getTestIds();

		const { batch, items } = await createTestBatch(orgId, userId, [
			{
				rawPrompt: "카카오톡 나에게 보내기",
				title: "kakao-me",
				estimatedComplexity: "light",
			},
			{
				rawPrompt: "슬랙 채널 웹훅 연동",
				title: "slack-webhook",
				estimatedComplexity: "light",
			},
			{
				rawPrompt: "카카오 싱크 로그인",
				title: "kakao-login",
				estimatedComplexity: "medium",
			},
		]);

		expect(batch.id).toBeDefined();
		expect(batch.totalItems).toBe(3);
		expect(batch.status).toBe("pending");
		expect(batch.concurrencyLimit).toBe(1);
		expect(items).toHaveLength(3);

		console.log(`✅ 배치 생성: ${batch.id} (${items.map((i) => i.title).join(", ")})`);
	});

	test("all-light 배치 → concurrency = items.length", async () => {
		const { orgId, userId } = await getTestIds();

		const { batch } = await createTestBatch(orgId, userId, [
			{ rawPrompt: "a", title: "a", estimatedComplexity: "light" },
			{ rawPrompt: "b", title: "b", estimatedComplexity: "light" },
		]);

		expect(batch.concurrencyLimit).toBe(2);
		console.log("✅ all-light → 전체 병렬");
	});

	test("nextItems: concurrency 제한 준수", async () => {
		const { orgId, userId } = await getTestIds();

		const { batch } = await createTestBatch(orgId, userId, [
			{ rawPrompt: "a", title: "next-a", estimatedComplexity: "light" },
			{ rawPrompt: "b", title: "next-b", estimatedComplexity: "light" },
		]);

		const next = await getNextItems(batch.id);
		expect(next.length).toBe(2);
		console.log(`✅ nextItems: ${next.map((i) => i.title).join(", ")}`);
	});

	test("상태 전이: pending → processing → completed → 배치 completed", async () => {
		const { orgId, userId } = await getTestIds();

		const { batch, items } = await createTestBatch(orgId, userId, [
			{ rawPrompt: "lifecycle", title: "lifecycle", estimatedComplexity: "light" },
		]);

		const item = items[0]!;
		await updateItemStatus(item.id, "processing", { sessionId: "s1" });

		let row = await db.query.featureQueueItems.findFirst({
			where: eq(featureQueueItems.id, item.id),
		});
		expect(row?.status).toBe("processing");
		expect(row?.startedAt).toBeDefined();

		await updateItemStatus(item.id, "completed");
		await syncBatchCounters(batch.id);

		row = await db.query.featureQueueItems.findFirst({
			where: eq(featureQueueItems.id, item.id),
		});
		expect(row?.status).toBe("completed");
		expect(row?.completedAt).toBeDefined();

		const b = await db.query.featureQueueBatches.findFirst({
			where: eq(featureQueueBatches.id, batch.id),
		});
		expect(b?.status).toBe("completed");
		console.log("✅ 라이프사이클 통과");
	});

	test("partial_failed: 1 성공 + 1 실패", async () => {
		const { orgId, userId } = await getTestIds();

		const { batch, items } = await createTestBatch(orgId, userId, [
			{ rawPrompt: "ok", title: "ok", estimatedComplexity: "light" },
			{ rawPrompt: "fail", title: "fail", estimatedComplexity: "light" },
		]);

		await updateItemStatus(items[0]!.id, "completed");
		await updateItemStatus(items[1]!.id, "failed", { lastError: "typecheck" });
		await syncBatchCounters(batch.id);

		const b = await db.query.featureQueueBatches.findFirst({
			where: eq(featureQueueBatches.id, batch.id),
		});
		expect(b?.status).toBe("partial_failed");
		expect(b?.completedItems).toBe(1);
		expect(b?.failedItems).toBe(1);
		console.log("✅ partial_failed 시나리오 통과");
	});

	test("resume: 완료된 아이템 건너뛰고 pending부터 재개", async () => {
		const { orgId, userId } = await getTestIds();

		const { batch, items } = await createTestBatch(orgId, userId, [
			{ rawPrompt: "done", title: "resume-done", estimatedComplexity: "medium" },
			{ rawPrompt: "todo", title: "resume-todo", estimatedComplexity: "medium" },
		]);

		await updateItemStatus(items[0]!.id, "completed");
		await syncBatchCounters(batch.id);

		const next = await getNextItems(batch.id);
		expect(next.length).toBe(1);
		expect(next[0]?.title).toBe("resume-todo");
		console.log("✅ resume 통과");
	});
});
