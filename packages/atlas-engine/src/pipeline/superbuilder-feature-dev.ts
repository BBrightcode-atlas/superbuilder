import { execFile as execFileCb } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type {
	ApprovalContext,
	FeatureDevCallbacks,
	FeatureDevInput,
	FeatureDevResult,
} from "./superbuilder-feature-dev-types";

const execFile = promisify(execFileCb);

// ── 기본 옵션 ────────────────────────────────────────────────
const DEFAULT_OPTS = {
	approvalMode: true,
	skipVerify: false,
	skipRegister: false,
};

// ── 메인 파이프라인 ──────────────────────────────────────────

/**
 * Superbuilder Feature Dev 파이프라인 — 인프라 오케스트레이터.
 *
 * AI 작업(spec/plan/implement)은 콜백으로 위임하고,
 * 인프라 작업(worktree, git, gh pr, typecheck)만 직접 수행한다.
 *
 * CLI 커맨드에서 호출할 때: 현재 실행 중인 agent가 AI 콜백을 직접 수행.
 * Desktop에서 호출할 때: UI 또는 agent session이 AI 콜백 수행.
 */
export async function superbuilderFeatureDevPipeline(
	input: FeatureDevInput,
	callbacks?: FeatureDevCallbacks,
): Promise<FeatureDevResult> {
	const opts = { ...DEFAULT_OPTS, ...input.options };
	const cb = callbacks ?? input.callbacks;

	const result: FeatureDevResult = {
		featureName: input.featureName ?? "",
		status: "running",
	};

	// 승인 요청 헬퍼
	async function requestApproval(
		type: ApprovalContext["type"],
		artifacts: ApprovalContext["artifacts"],
		summary?: string,
	): Promise<"approved" | "rejected"> {
		if (!opts.approvalMode || !cb?.onApproval) return "approved";
		return cb.onApproval(type, {
			featureRequestId: result.featureName,
			type,
			artifacts,
			summary,
		});
	}

	// ── Step 1: generateSpec (FATAL) ──────────────────────────────
	cb?.onStep?.("generateSpec", "start", "Spec 생성 중...");
	if (!cb?.onGenerate) {
		throw new Error(
			"onGenerate 콜백이 필요합니다. AI 작업은 호출자가 수행해야 합니다.",
		);
	}
	const spec = await cb.onGenerate("spec", input.prompt, result.featureName);
	result.spec = spec;

	if (!result.featureName) {
		// spec에서 feature name 추출
		const match = spec.match(/FEATURE_NAME:\s*(\S+)/m);
		result.featureName = match?.[1] ?? `feature_${Date.now()}`;
	}
	cb?.onStep?.(
		"generateSpec",
		"done",
		`Spec 완료 (feature: ${result.featureName})`,
	);

	// ── Step 2: generatePlan (FATAL) ──────────────────────────────
	cb?.onStep?.("generatePlan", "start", "Plan 생성 중...");
	const plan = await cb.onGenerate("plan", spec, result.featureName);
	result.plan = plan;
	cb?.onStep?.("generatePlan", "done", "Plan 완료");

	// ── [Approval: spec_plan] ─────────────────────────────────────
	const specPlanDecision = await requestApproval(
		"spec_plan",
		[
			{ kind: "spec", content: spec },
			{ kind: "plan", content: plan },
		],
		`피처 "${result.featureName}" Spec/Plan 검토`,
	);
	if (specPlanDecision === "rejected") {
		result.status = "rejected_at_spec";
		return result;
	}

	// ── Step 3: createWorktree (FATAL) ────────────────────────────
	const worktreeBase =
		opts.worktreeBasePath ?? join(homedir(), ".superbuilder", "worktrees");
	if (!existsSync(worktreeBase)) {
		mkdirSync(worktreeBase, { recursive: true });
	}

	const branchName = `feature/${result.featureName}`;
	const worktreePath = join(worktreeBase, result.featureName);
	result.branchName = branchName;
	result.worktreePath = worktreePath;

	cb?.onStep?.("createWorktree", "start", `Worktree: ${worktreePath}`);
	await execFile("git", ["worktree", "add", worktreePath, "-b", branchName], {
		cwd: input.featuresRepoPath,
	});
	cb?.onStep?.("createWorktree", "done", "Worktree 생성 완료");

	// ── Step 4: implement (NON-FATAL) ─────────────────────────────
	cb?.onStep?.("implement", "start", "피처 구현 중...");
	try {
		await cb.onGenerate("implement", plan, result.featureName);
		cb?.onStep?.("implement", "done", "구현 완료");
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		cb?.onStep?.("implement", "error", msg);
	}

	// ── Step 5: verify (NON-FATAL) ────────────────────────────────
	if (!opts.skipVerify) {
		cb?.onStep?.("verify", "start", "typecheck + lint...");
		try {
			await execFile("bun", ["run", "typecheck"], {
				cwd: worktreePath,
				timeout: 5 * 60 * 1000,
			});
			await execFile("bun", ["run", "lint"], {
				cwd: worktreePath,
				timeout: 3 * 60 * 1000,
			});
			result.verifyPassed = true;
			cb?.onStep?.("verify", "done", "통과");
		} catch (e) {
			result.verifyPassed = false;
			cb?.onStep?.(
				"verify",
				"error",
				e instanceof Error ? e.message : String(e),
			);
		}
	} else {
		cb?.onStep?.("verify", "skip");
	}

	// ── [Approval: human_qa] ──────────────────────────────────────
	const qaDecision = await requestApproval(
		"human_qa",
		undefined,
		`피처 "${result.featureName}" QA (검증: ${result.verifyPassed ? "PASS" : "FAIL"}, worktree: ${worktreePath})`,
	);
	if (qaDecision === "rejected") {
		result.status = "rejected_at_human_qa";
		await cleanupWorktree(worktreePath, input.featuresRepoPath, cb);
		return result;
	}

	// ── Step 6: register (NON-FATAL) ──────────────────────────────
	if (!opts.skipRegister) {
		cb?.onStep?.("register", "start", "PR 생성 중...");
		try {
			await execFile("git", ["push", "origin", branchName], {
				cwd: worktreePath,
				timeout: 60_000,
			});
			const { stdout: prOutput } = await execFile(
				"gh",
				[
					"pr",
					"create",
					"--base",
					"develop",
					"--title",
					`feat: add ${result.featureName} feature`,
					"--body",
					`Auto-generated by superbuilder-feature-dev`,
				],
				{ cwd: worktreePath, timeout: 60_000 },
			);
			result.prUrl = prOutput.trim();
			cb?.onStep?.("register", "done", `PR: ${result.prUrl}`);
		} catch (e) {
			cb?.onStep?.(
				"register",
				"error",
				e instanceof Error ? e.message : String(e),
			);
		}
	} else {
		cb?.onStep?.("register", "skip");
	}

	// ── [Approval: registration] ──────────────────────────────────
	if (result.prUrl) {
		const regDecision = await requestApproval(
			"registration",
			undefined,
			`PR: ${result.prUrl}`,
		);
		if (regDecision === "rejected") {
			try {
				await execFile("gh", ["pr", "close", result.prUrl], {
					cwd: worktreePath,
					timeout: 30_000,
				});
			} catch {}
			result.status = "rejected_at_registration";
			await cleanupWorktree(worktreePath, input.featuresRepoPath, cb);
			return result;
		}
	}

	// ── Step 7: complete ──────────────────────────────────────────
	if (result.prUrl) {
		cb?.onStep?.("complete", "start", "PR merge...");
		try {
			await execFile(
				"gh",
				["pr", "merge", result.prUrl, "--merge", "--delete-branch"],
				{
					cwd: worktreePath,
					timeout: 60_000,
				},
			);
			cb?.onStep?.("complete", "done", "머지 완료");
		} catch (e) {
			cb?.onStep?.(
				"complete",
				"error",
				e instanceof Error ? e.message : String(e),
			);
		}
	}

	// ── Step 8: cleanup ──────────────────────────────────────────
	await cleanupWorktree(worktreePath, input.featuresRepoPath, cb);

	result.status = "complete";
	cb?.onLog?.("파이프라인 완료");
	return result;
}

async function cleanupWorktree(
	worktreePath: string,
	featuresRepoPath: string,
	cb: FeatureDevCallbacks | undefined,
): Promise<void> {
	cb?.onStep?.("cleanup", "start", "Worktree 정리...");
	try {
		await execFile("git", ["worktree", "remove", worktreePath, "--force"], {
			cwd: featuresRepoPath,
			timeout: 30_000,
		});
		cb?.onStep?.("cleanup", "done", "정리 완료");
	} catch {
		cb?.onStep?.(
			"cleanup",
			"error",
			`수동 제거 필요: git worktree remove ${worktreePath} --force`,
		);
	}
}
