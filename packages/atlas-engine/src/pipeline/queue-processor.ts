import { superbuilderFeatureDevPipeline } from "./superbuilder-feature-dev";
import type {
	FeatureDevCallbacks,
	FeatureDevResult,
} from "./superbuilder-feature-dev-types";

// ── Types ────────────────────────────────────────────────────

export interface QueueItem {
	id: string;
	batchId: string;
	position: number;
	rawPrompt: string;
	title: string | null;
	estimatedComplexity: "light" | "medium" | "heavy";
	sessionId: string | null;
	resumeToken: string | null;
}

export interface QueueBatch {
	id: string;
	concurrencyLimit: number;
	totalItems: number;
}

export interface QueueApi {
	getBatch(batchId: string): Promise<QueueBatch & { items: QueueItem[] }>;
	nextItems(batchId: string): Promise<QueueItem[]>;
	updateItemStatus(params: {
		itemId: string;
		status: string;
		sessionId?: string;
		resumeToken?: string;
		featureRequestId?: string;
		lastError?: string;
	}): Promise<void>;
}

export interface QueueProcessorCallbacks extends FeatureDevCallbacks {
	onItemStart?: (item: QueueItem, index: number, total: number) => void;
	onItemComplete?: (
		item: QueueItem,
		result: FeatureDevResult,
		index: number,
		total: number,
	) => void;
	onItemError?: (
		item: QueueItem,
		error: string,
		index: number,
		total: number,
	) => void;
	onBatchComplete?: (
		batchId: string,
		results: Map<string, FeatureDevResult>,
	) => void;
}

export interface QueueProcessorInput {
	batchId: string;
	featuresRepoPath: string;
	api: QueueApi;
	callbacks?: QueueProcessorCallbacks;
	sessionId?: string;
}

// ── Processor ────────────────────────────────────────────────

/**
 * Queue Processor — 배치의 아이템을 순서대로 (또는 병렬로) 처리.
 *
 * concurrencyLimit에 따라 light 아이템은 병렬 실행,
 * heavy 아이템은 순차 실행.
 */
export async function processQueue(
	input: QueueProcessorInput,
): Promise<Map<string, FeatureDevResult>> {
	const { batchId, featuresRepoPath, api, callbacks } = input;
	const sessionId =
		input.sessionId ??
		`session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	const results = new Map<string, FeatureDevResult>();

	const batch = await api.getBatch(batchId);
	const total = batch.totalItems;

	let processedCount = 0;

	while (true) {
		const nextItems = await api.nextItems(batchId);
		if (nextItems.length === 0) break;

		// 병렬 실행: concurrencyLimit만큼 동시 처리
		const tasks = nextItems.map((item) =>
			processItem(item, processedCount++, total),
		);
		await Promise.allSettled(tasks);
	}

	callbacks?.onBatchComplete?.(batchId, results);
	return results;

	async function processItem(
		item: QueueItem,
		index: number,
		totalItems: number,
	): Promise<void> {
		callbacks?.onItemStart?.(item, index, totalItems);

		await api.updateItemStatus({
			itemId: item.id,
			status: "processing",
			sessionId,
		});

		try {
			const result = await superbuilderFeatureDevPipeline({
				prompt: item.rawPrompt,
				featureName: item.title ?? undefined,
				featuresRepoPath,
				options: {
					approvalMode: false,
				},
				callbacks,
			});

			await api.updateItemStatus({
				itemId: item.id,
				status: "completed",
				resumeToken: JSON.stringify({
					featureName: result.featureName,
					worktreePath: result.worktreePath,
					branchName: result.branchName,
					prUrl: result.prUrl,
				}),
			});

			results.set(item.id, result);
			callbacks?.onItemComplete?.(item, result, index, totalItems);
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : String(e);

			await api.updateItemStatus({
				itemId: item.id,
				status: "failed",
				lastError: errorMsg,
			});

			callbacks?.onItemError?.(item, errorMsg, index, totalItems);
		}
	}
}
