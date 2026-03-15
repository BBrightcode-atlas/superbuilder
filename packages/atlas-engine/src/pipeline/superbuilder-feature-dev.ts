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
	agent: "claude" as const,
	skipVerify: false,
	skipRegister: false,
};

// ── CLI spawn 헬퍼 ───────────────────────────────────────────

/**
 * claude 또는 codex CLI를 지정된 cwd에서 실행하고 stdout을 반환한다.
 * 타임아웃 10분, maxBuffer 10MB.
 */
async function spawnClaude(
	cwd: string,
	prompt: string,
	agent: "claude" | "codex",
): Promise<string> {
	const cmd = agent === "codex" ? "codex" : "claude";
	// claude CLI: `claude -p "<prompt>"` (print mode, non-interactive)
	// codex CLI: `codex exec "<prompt>"`
	const args =
		agent === "codex" ? ["exec", prompt] : ["-p", prompt, "--output-format", "text"];

	const { stdout } = await execFile(cmd, args, {
		cwd,
		timeout: 10 * 60 * 1000, // 10분
		maxBuffer: 10 * 1024 * 1024, // 10MB
	});
	return stdout.trim();
}

// ── 프롬프트 빌더 ────────────────────────────────────────────

/** 사용자 요구사항으로부터 피처 Spec을 생성하는 프롬프트 */
function buildSpecPrompt(userPrompt: string): string {
	return `You are a senior software architect. Generate a concise feature specification for the following requirement.

Requirement:
${userPrompt}

Output format:
- Start with a single line: "FEATURE_NAME: <snake_case_name>"
- Then write the spec in markdown

The spec should cover: overview, user stories, data model, API contracts, and acceptance criteria.`;
}

/** Spec을 기반으로 구현 Plan을 생성하는 프롬프트 */
function buildPlanPrompt(spec: string, featureName: string): string {
	return `You are a senior software engineer. Create a step-by-step implementation plan for the following feature spec.

Feature: ${featureName}

Spec:
${spec}

Output a detailed implementation plan in markdown covering:
1. File structure to create/modify
2. Database schema changes (if any)
3. Backend implementation steps
4. Frontend implementation steps
5. Integration and wiring steps
6. Testing checklist`;
}

/** Plan을 기반으로 피처를 구현하는 프롬프트 */
function buildImplementPrompt(featureName: string, plan: string): string {
	return `You are an expert TypeScript/React developer working in a Bun monorepo boilerplate.
Implement the feature "${featureName}" following the plan below exactly.

Implementation Plan:
${plan}

Instructions:
- Follow the existing code style and patterns in the repo
- Add ATLAS marker blocks where required:
  // [ATLAS:IMPORTS]
  import { ... } from "...";
  // [/ATLAS:IMPORTS]
- Update superbuilder.json with the new feature entry
- Commit all changes with message: "feat(${featureName}): implement feature"
- Do NOT push — only commit locally`;
}

// ── featureName 추출 헬퍼 ────────────────────────────────────

/**
 * spec 출력의 첫 번째 줄에서 "FEATURE_NAME: <name>" 패턴으로 피처 이름을 추출한다.
 * 없으면 null을 반환한다.
 */
function extractFeatureName(specOutput: string): string | null {
	const match = specOutput.match(/^FEATURE_NAME:\s*(\S+)/m);
	return match?.[1] ?? null;
}

// ── 메인 파이프라인 ──────────────────────────────────────────

/**
 * Superbuilder Feature Dev 파이프라인 오케스트레이터.
 *
 * 피처 개발 전 과정을 순서대로 실행한다:
 * spec 생성 → plan 생성 → [spec_plan 승인] → worktree 생성 →
 * 구현 → 검증 → [human_qa 승인] → 등록(PR) → [registration 승인] → 완료 → cleanup
 *
 * Fatal 스텝(generateSpec, generatePlan, createWorktree)은 실패 시 throw.
 * Non-fatal 스텝은 에러를 로그하고 계속 진행한다.
 */
export async function superbuilderFeatureDevPipeline(
	input: FeatureDevInput,
	callbacks?: FeatureDevCallbacks,
): Promise<FeatureDevResult> {
	const opts = { ...DEFAULT_OPTS, ...input.options };
	const cb = callbacks ?? input.callbacks;

	// 결과 누적용 상태
	const result: FeatureDevResult = {
		featureName: input.featureName ?? "",
		status: "running",
	};

	// 승인 요청 헬퍼 — approvalMode가 꺼져 있거나 콜백 없으면 자동 승인
	async function requestApproval(
		type: ApprovalContext["type"],
		artifacts: ApprovalContext["artifacts"],
		summary?: string,
	): Promise<"approved" | "rejected"> {
		if (!opts.approvalMode || !cb?.onApproval) return "approved";
		const ctx: ApprovalContext = {
			featureRequestId: result.featureName,
			type,
			artifacts,
			summary,
		};
		return cb.onApproval(type, ctx);
	}

	// ── Step 1: generateSpec (FATAL) ──────────────────────────────
	cb?.onStep?.("generateSpec", "start", "Spec 생성 중...");
	const specOutput = await spawnClaude(
		input.boilerplatePath,
		buildSpecPrompt(input.prompt),
		opts.agent,
	);
	result.spec = specOutput;

	// 피처 이름이 주어지지 않은 경우 spec 출력에서 추출
	if (!result.featureName) {
		const extracted = extractFeatureName(specOutput);
		result.featureName = extracted ?? `feature_${Date.now()}`;
	}
	cb?.onStep?.("generateSpec", "done", `Spec 생성 완료 (feature: ${result.featureName})`);

	// ── Step 2: generatePlan (FATAL) ──────────────────────────────
	cb?.onStep?.("generatePlan", "start", "Plan 생성 중...");
	const planOutput = await spawnClaude(
		input.boilerplatePath,
		buildPlanPrompt(result.spec, result.featureName),
		opts.agent,
	);
	result.plan = planOutput;
	cb?.onStep?.("generatePlan", "done", "Plan 생성 완료");

	// ── [Approval: spec_plan] ─────────────────────────────────────
	const specPlanDecision = await requestApproval(
		"spec_plan",
		[
			{ kind: "spec", content: result.spec },
			{ kind: "plan", content: result.plan },
		],
		`피처 "${result.featureName}" Spec/Plan 검토 요청`,
	);
	if (specPlanDecision === "rejected") {
		cb?.onLog?.("Spec/Plan이 거절되었습니다. 파이프라인을 종료합니다.");
		result.status = "rejected_at_spec";
		return result;
	}

	// ── Step 3: createWorktree (FATAL) ────────────────────────────
	const worktreeBase =
		opts.worktreeBasePath ?? join(homedir(), ".superbuilder", "worktrees");

	// ~/.superbuilder/worktrees/ 디렉토리 생성 (없으면)
	if (!existsSync(worktreeBase)) {
		mkdirSync(worktreeBase, { recursive: true });
	}

	const branchName = `feature/${result.featureName}`;
	const worktreePath = join(worktreeBase, result.featureName);
	result.branchName = branchName;
	result.worktreePath = worktreePath;

	cb?.onStep?.("createWorktree", "start", `Worktree 생성 중: ${worktreePath}`);
	await execFile(
		"git",
		["worktree", "add", worktreePath, "-b", branchName],
		{ cwd: input.boilerplatePath },
	);
	cb?.onStep?.("createWorktree", "done", `Worktree 생성 완료: ${worktreePath}`);

	// ── Step 4: implement (NON-FATAL) ─────────────────────────────
	cb?.onStep?.("implement", "start", "피처 구현 중...");
	try {
		await spawnClaude(
			worktreePath,
			buildImplementPrompt(result.featureName, result.plan),
			opts.agent,
		);
		cb?.onStep?.("implement", "done", "구현 완료");
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		cb?.onStep?.("implement", "error", msg);
		cb?.onLog?.("구현 중 오류 발생 — 검증 및 이후 단계를 계속 진행합니다");
	}

	// ── Step 5: verify (NON-FATAL, skippable) ────────────────────
	if (!opts.skipVerify) {
		cb?.onStep?.("verify", "start", "타입체크 및 린트 실행 중...");
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
			cb?.onStep?.("verify", "done", "타입체크 및 린트 통과");
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			result.verifyPassed = false;
			cb?.onStep?.("verify", "error", msg);
			cb?.onLog?.("검증 실패 — 이후 단계를 계속 진행합니다");
		}
	} else {
		result.verifyPassed = undefined;
		cb?.onStep?.("verify", "skip", "skipVerify 옵션으로 건너뜀");
	}

	// ── [Approval: human_qa] ──────────────────────────────────────
	const humanQaDecision = await requestApproval(
		"human_qa",
		[
			{ kind: "spec", content: result.spec ?? "" },
			{ kind: "plan", content: result.plan ?? "" },
		],
		`피처 "${result.featureName}" Human QA 검토 요청 (검증: ${result.verifyPassed ? "통과" : "실패/미실행"})`,
	);
	if (humanQaDecision === "rejected") {
		cb?.onLog?.("Human QA 거절. 파이프라인을 종료합니다.");
		result.status = "rejected_at_human_qa";
		// cleanup
		await cleanupWorktree(worktreePath, input.boilerplatePath, cb);
		return result;
	}

	// ── Step 6: register (NON-FATAL, skippable) ──────────────────
	let prUrl: string | undefined;
	if (!opts.skipRegister) {
		cb?.onStep?.("register", "start", `브랜치 푸시 및 PR 생성 중: ${branchName}`);
		try {
			// 브랜치를 원격으로 푸시
			await execFile("git", ["push", "origin", branchName], {
				cwd: worktreePath,
				timeout: 60_000,
			});

			// PR 생성 (base: develop)
			const { stdout: prOutput } = await execFile(
				"gh",
				[
					"pr",
					"create",
					"--base",
					"develop",
					"--title",
					`feat: ${result.featureName}`,
					"--body",
					`## Feature: ${result.featureName}\n\n### Spec\n${result.spec}\n\n### Plan\n${result.plan}`,
				],
				{
					cwd: worktreePath,
					timeout: 60_000,
				},
			);
			prUrl = prOutput.trim();
			result.prUrl = prUrl;
			cb?.onStep?.("register", "done", `PR 생성 완료: ${prUrl}`);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			cb?.onStep?.("register", "error", msg);
			cb?.onLog?.("PR 생성 실패 — 이후 단계를 계속 진행합니다");
		}
	} else {
		cb?.onStep?.("register", "skip", "skipRegister 옵션으로 건너뜀");
	}

	// ── [Approval: registration] ──────────────────────────────────
	if (prUrl) {
		const registrationDecision = await requestApproval(
			"registration",
			[{ kind: "pr_url", content: prUrl }],
			`피처 "${result.featureName}" 최종 등록 검토 요청 (PR: ${prUrl})`,
		);
		if (registrationDecision === "rejected") {
			cb?.onLog?.("등록 거절. PR을 닫고 종료합니다.");
			// PR 닫기
			try {
				await execFile("gh", ["pr", "close", prUrl, "--comment", "등록이 거절되었습니다."], {
					cwd: worktreePath,
					timeout: 30_000,
				});
			} catch {
				// non-fatal
			}
			result.status = "rejected_at_registration";
			await cleanupWorktree(worktreePath, input.boilerplatePath, cb);
			return result;
		}
	}

	// ── Step 7: complete (NON-FATAL) ──────────────────────────────
	if (prUrl) {
		cb?.onStep?.("complete", "start", `PR 머지 중: ${prUrl}`);
		try {
			await execFile("gh", ["pr", "merge", prUrl, "--merge", "--delete-branch"], {
				cwd: worktreePath,
				timeout: 60_000,
			});
			cb?.onStep?.("complete", "done", "PR 머지 완료");
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			cb?.onStep?.("complete", "error", msg);
			cb?.onLog?.("PR 머지 실패 — cleanup을 계속 진행합니다");
		}
	} else {
		cb?.onStep?.("complete", "skip", "PR이 없어 머지 건너뜀");
	}

	// ── Step 8: cleanup (NON-FATAL) ───────────────────────────────
	await cleanupWorktree(worktreePath, input.boilerplatePath, cb);

	result.status = "complete";
	cb?.onLog?.("Feature Dev 파이프라인 완료");
	return result;
}

// ── cleanup 헬퍼 ─────────────────────────────────────────────

/** worktree를 제거하는 non-fatal 헬퍼 */
async function cleanupWorktree(
	worktreePath: string,
	boilerplatePath: string,
	cb: FeatureDevCallbacks | undefined,
): Promise<void> {
	cb?.onStep?.("cleanup", "start", `Worktree 제거 중: ${worktreePath}`);
	try {
		await execFile("git", ["worktree", "remove", worktreePath, "--force"], {
			cwd: boilerplatePath,
			timeout: 30_000,
		});
		cb?.onStep?.("cleanup", "done", "Worktree 제거 완료");
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		cb?.onStep?.("cleanup", "error", msg);
		cb?.onLog?.(`Worktree 제거 실패 — 수동 제거: git worktree remove ${worktreePath} --force`);
	}
}
