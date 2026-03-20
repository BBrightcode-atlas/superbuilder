/**
 * 큐 상태 업데이트 유틸리티
 * Usage: bun run src/tests/queue-status.ts <command> [args]
 *   status <batchId>           — 배치 상태 출력
 *   start <itemId>             — 아이템을 processing으로
 *   complete <itemId>          — 아이템을 completed로
 *   fail <itemId> <error>      — 아이템을 failed로
 *   sync <batchId>             — 배치 카운터 동기화
 */
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "../client";
import {
	featureQueueBatches,
	featureQueueItems,
} from "../schema/feature-studio";

const [, , command, ...args] = process.argv;

async function showStatus(batchId: string) {
	const batch = await db.query.featureQueueBatches.findFirst({
		where: eq(featureQueueBatches.id, batchId),
		with: { items: { orderBy: [asc(featureQueueItems.position)] } },
	});
	if (!batch) {
		console.log("배치를 찾을 수 없습니다:", batchId);
		return;
	}

	const statusIcon: Record<string, string> = {
		pending: "⏳",
		processing: "🔄",
		completed: "✅",
		failed: "❌",
		cancelled: "🚫",
		partial_failed: "⚠️",
		waiting_deps: "⏸️",
		paused: "⏸️",
	};

	console.log(`\n📦 배치: "${batch.title}" (${batch.id})`);
	console.log(`   상태: ${statusIcon[batch.status] ?? "?"} ${batch.status}`);
	console.log(
		`   진행: ${batch.completedItems}/${batch.totalItems} 완료, ${batch.failedItems} 실패`,
	);
	console.log(`   동시성: ${batch.concurrencyLimit}`);
	console.log("");

	for (const item of batch.items) {
		const icon = statusIcon[item.status] ?? "?";
		const elapsed =
			item.startedAt && item.completedAt
				? ` (${Math.round((item.completedAt.getTime() - item.startedAt.getTime()) / 1000)}s)`
				: item.startedAt
					? " (진행중)"
					: "";
		console.log(
			`  [${item.position}] ${icon} ${item.title ?? "?"} — ${item.status}${elapsed}`,
		);
		if (item.lastError) console.log(`      에러: ${item.lastError}`);
		if (item.sessionId) console.log(`      세션: ${item.sessionId}`);
	}
	console.log("");
}

async function startItem(itemId: string) {
	await db
		.update(featureQueueItems)
		.set({
			status: "processing",
			startedAt: new Date(),
			sessionId: `cli-${Date.now()}`,
		})
		.where(eq(featureQueueItems.id, itemId));
	console.log(`🔄 아이템 ${itemId} → processing`);
}

async function completeItem(itemId: string) {
	await db
		.update(featureQueueItems)
		.set({ status: "completed", completedAt: new Date() })
		.where(eq(featureQueueItems.id, itemId));
	console.log(`✅ 아이템 ${itemId} → completed`);
}

async function failItem(itemId: string, error: string) {
	await db
		.update(featureQueueItems)
		.set({ status: "failed", completedAt: new Date(), lastError: error })
		.where(eq(featureQueueItems.id, itemId));
	console.log(`❌ 아이템 ${itemId} → failed: ${error}`);
}

async function syncBatch(batchId: string) {
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

	const c = completed?.count ?? 0;
	const f = failed?.count ?? 0;
	let status = batch.status;
	if (c + f >= batch.totalItems) {
		status = f === 0 ? "completed" : c === 0 ? "failed" : "partial_failed";
	} else if (c > 0 || f > 0) {
		status = "processing";
	}

	await db
		.update(featureQueueBatches)
		.set({ completedItems: c, failedItems: f, status })
		.where(eq(featureQueueBatches.id, batchId));

	console.log(`🔄 배치 동기화: ${status} (${c} 완료, ${f} 실패)`);
}

async function main() {
	switch (command) {
		case "status":
			await showStatus(args[0]!);
			break;
		case "start":
			await startItem(args[0]!);
			break;
		case "complete":
			await completeItem(args[0]!);
			break;
		case "fail":
			await failItem(args[0]!, args.slice(1).join(" "));
			break;
		case "sync":
			await syncBatch(args[0]!);
			break;
		default:
			console.log(
				"Usage: queue-status.ts <status|start|complete|fail|sync> [args]",
			);
	}
	process.exit(0);
}

main().catch(console.error);
