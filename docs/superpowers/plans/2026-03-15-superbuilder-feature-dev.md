# Superbuilder Feature Dev Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feature 개발 전체 흐름(spec → plan → implement → verify → register)을 CLI 실행 가능한 파이프라인으로 구현

**Architecture:** atlas-engine에 `superbuilderFeatureDevPipeline()` 함수 추가. 메인 API(packages/trpc)에 누락 프로시저 완성. CLI 커맨드 `/superbuilder-feature-dev`, `/superbuilder-feature-verify` 제공.

**Tech Stack:** TypeScript, Drizzle ORM, tRPC, Node.js child_process (claude CLI spawn)

**Spec:** `docs/superpowers/specs/2026-03-15-feature-dev-pipeline-design.md`

---

## File Structure

### 신규 파일
- `packages/atlas-engine/src/pipeline/superbuilder-feature-dev.ts` — 파이프라인 오케스트레이터
- `packages/atlas-engine/src/pipeline/superbuilder-feature-dev-types.ts` — 타입 정의
- `.agents/commands/superbuilder-feature-dev.md` — CLI 커맨드 (기존 feature-dev.md 대체)
- `.agents/commands/superbuilder-feature-verify.md` — E2E 검증 커맨드

### 수정 파일
- `packages/trpc/src/router/feature-studio/feature-studio.ts` — 누락 프로시저 6개 추가 + advance 구현
- `packages/trpc/src/router/feature-studio/schema.ts` — 새 input 스키마 추가
- `packages/atlas-engine/src/pipeline/index.ts` — export 추가

---

## Chunk 1: tRPC 프로시저 완성

### Task 1: 새 input 스키마 추가

**Files:**
- Modify: `packages/trpc/src/router/feature-studio/schema.ts`

- [ ] **Step 1: 스키마 추가**

```typescript
// packages/trpc/src/router/feature-studio/schema.ts 에 추가

export const appendMessageSchema = z.object({
	featureRequestId: z.string().uuid(),
	role: z.enum(["system", "assistant", "user"]),
	content: z.string().min(1),
	kind: z.enum(["conversation", "event", "note"]).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export const saveArtifactSchema = z.object({
	featureRequestId: z.string().uuid(),
	kind: z.enum([
		"spec",
		"plan",
		"implementation_summary",
		"verification_report",
		"agent_qa_report",
		"human_qa_notes",
		"registration_manifest",
		"preview_metadata",
	]),
	content: z.string().min(1),
	version: z.number().int().positive().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateStatusSchema = z.object({
	featureRequestId: z.string().uuid(),
	status: featureRequestStatusEnum,
	errorMessage: z.string().optional(),
});

export const saveWorktreeSchema = z.object({
	featureRequestId: z.string().uuid(),
	worktreePath: z.string().min(1),
	branchName: z.string().min(1),
	baseBranch: z.string().default("develop"),
});

export const createRunSchema = z.object({
	featureRequestId: z.string().uuid(),
	workflowName: z.string().min(1),
	workflowStep: z.string().min(1),
});

export const updateRunSchema = z.object({
	runId: z.string().uuid(),
	status: z.enum(["queued", "running", "paused", "completed", "failed", "cancelled"]),
	lastError: z.string().optional(),
});
```

- [ ] **Step 2: 타입체크**

Run: `bun run typecheck --filter=@superset/trpc 2>&1 | grep -E "schema\.ts|error TS"`
Expected: schema.ts 관련 에러 없음 (기존 에러는 무시)

- [ ] **Step 3: Commit**

```bash
git add packages/trpc/src/router/feature-studio/schema.ts
git commit -m "feat(trpc): add feature-studio input schemas for missing procedures"
```

---

### Task 2: 누락 프로시저 6개 추가

**Files:**
- Modify: `packages/trpc/src/router/feature-studio/feature-studio.ts`

- [ ] **Step 1: import 추가**

feature-studio.ts 상단에 추가:
```typescript
import {
	featureRequestRuns,
	featureRequestWorktrees,
} from "@superset/db/schema";
```

schema.ts import 확장:
```typescript
import {
	createFeatureRequestSchema,
	listQueueSchema,
	respondToApprovalSchema,
	appendMessageSchema,
	saveArtifactSchema,
	updateStatusSchema,
	saveWorktreeSchema,
	createRunSchema,
	updateRunSchema,
} from "./schema";
```

- [ ] **Step 2: appendMessage 프로시저 추가**

`registerRequest` 뒤에 추가:

```typescript
	appendMessage: protectedProcedure
		.input(appendMessageSchema)
		.mutation(async ({ input }) => {
			const [message] = await db
				.insert(featureRequestMessages)
				.values({
					featureRequestId: input.featureRequestId,
					role: input.role,
					content: input.content,
					kind: input.kind ?? "conversation",
					metadata: input.metadata ?? null,
				})
				.returning();

			return message;
		}),
```

- [ ] **Step 3: saveArtifact 프로시저 추가**

```typescript
	saveArtifact: protectedProcedure
		.input(saveArtifactSchema)
		.mutation(async ({ ctx, input }) => {
			// 같은 kind의 최신 version 조회
			const existing = await db.query.featureRequestArtifacts.findFirst({
				where: and(
					eq(featureRequestArtifacts.featureRequestId, input.featureRequestId),
					eq(featureRequestArtifacts.kind, input.kind),
				),
				orderBy: [desc(featureRequestArtifacts.version)],
			});

			const nextVersion = input.version ?? (existing ? existing.version + 1 : 1);

			const [artifact] = await db
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

			return artifact;
		}),
```

- [ ] **Step 4: updateStatus 프로시저 추가**

```typescript
	updateStatus: protectedProcedure
		.input(updateStatusSchema)
		.mutation(async ({ input }) => {
			const [updated] = await db
				.update(featureRequests)
				.set({
					status: input.status,
					...(input.errorMessage !== undefined && {
						// Store error in a message for now
					}),
				})
				.where(eq(featureRequests.id, input.featureRequestId))
				.returning();

			if (!updated) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Feature request not found: ${input.featureRequestId}`,
				});
			}

			// 에러 메시지가 있으면 event로 기록
			if (input.errorMessage) {
				await db.insert(featureRequestMessages).values({
					featureRequestId: input.featureRequestId,
					role: "system",
					kind: "event",
					content: `Status changed to ${input.status}: ${input.errorMessage}`,
				});
			}

			return updated;
		}),
```

- [ ] **Step 5: saveWorktree 프로시저 추가**

```typescript
	saveWorktree: protectedProcedure
		.input(saveWorktreeSchema)
		.mutation(async ({ input }) => {
			const [worktree] = await db
				.insert(featureRequestWorktrees)
				.values({
					featureRequestId: input.featureRequestId,
					worktreePath: input.worktreePath,
					branchName: input.branchName,
					baseBranch: input.baseBranch,
				})
				.returning();

			return worktree;
		}),
```

- [ ] **Step 6: createRun, updateRun 프로시저 추가**

```typescript
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

			// featureRequest의 currentRunId 업데이트
			await db
				.update(featureRequests)
				.set({ currentRunId: run.id })
				.where(eq(featureRequests.id, input.featureRequestId));

			return run;
		}),

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
```

- [ ] **Step 7: advance 상태 머신 구현**

기존 TODO stub을 교체:

```typescript
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

			const STATE_TRANSITIONS: Record<string, string> = {
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
					message: `Cannot advance from status: ${request.status}`,
				});
			}

			const [updated] = await db
				.update(featureRequests)
				.set({ status: nextStatus as typeof request.status })
				.where(eq(featureRequests.id, input.featureRequestId))
				.returning();

			return updated;
		}),
```

- [ ] **Step 8: 타입체크**

Run: `bun run typecheck --filter=@superset/trpc 2>&1 | grep -E "feature-studio\.ts|error TS"`
Expected: feature-studio.ts 관련 에러 없음

- [ ] **Step 9: Commit**

```bash
git add packages/trpc/src/router/feature-studio/
git commit -m "feat(trpc): complete feature-studio router with 6 new procedures + advance state machine"
```

---

## Chunk 2: atlas-engine 파이프라인

### Task 3: 타입 정의

**Files:**
- Create: `packages/atlas-engine/src/pipeline/superbuilder-feature-dev-types.ts`

- [ ] **Step 1: 타입 파일 작성**

```typescript
// packages/atlas-engine/src/pipeline/superbuilder-feature-dev-types.ts

export type FeatureDevStep =
	| "createRequest"
	| "generateSpec"
	| "generatePlan"
	| "createWorktree"
	| "implement"
	| "verify"
	| "register"
	| "complete"
	| "cleanup";

export interface ApprovalContext {
	featureRequestId: string;
	type: "spec_plan" | "human_qa" | "registration";
	artifacts?: { kind: string; content: string }[];
	summary?: string;
}

export interface FeatureDevCallbacks {
	onStep?: (
		step: FeatureDevStep,
		status: "start" | "done" | "skip" | "error",
		message?: string,
	) => void;
	onLog?: (message: string) => void;
	onApproval?: (
		type: "spec_plan" | "human_qa" | "registration",
		context: ApprovalContext,
	) => Promise<"approved" | "rejected">;
}

export interface FeatureDevOptions {
	approvalMode?: boolean;
	agent?: "claude" | "codex";
	skipVerify?: boolean;
	skipRegister?: boolean;
	worktreeBasePath?: string;
	featuresSourceDir?: string;
}

export interface FeatureDevInput {
	prompt: string;
	featureName?: string;
	boilerplatePath: string;
	options?: FeatureDevOptions;
	callbacks?: FeatureDevCallbacks;
}

export interface FeatureDevResult {
	featureName: string;
	status: string;
	spec?: string;
	plan?: string;
	worktreePath?: string;
	branchName?: string;
	prUrl?: string;
	verifyPassed?: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/atlas-engine/src/pipeline/superbuilder-feature-dev-types.ts
git commit -m "feat(atlas-engine): add superbuilder-feature-dev type definitions"
```

---

### Task 4: 파이프라인 오케스트레이터

**Files:**
- Create: `packages/atlas-engine/src/pipeline/superbuilder-feature-dev.ts`
- Modify: `packages/atlas-engine/src/pipeline/index.ts`

- [ ] **Step 1: 파이프라인 함수 작성**

```typescript
// packages/atlas-engine/src/pipeline/superbuilder-feature-dev.ts

import { join } from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync } from "node:fs";
import type {
	FeatureDevCallbacks,
	FeatureDevInput,
	FeatureDevOptions,
	FeatureDevResult,
	FeatureDevStep,
} from "./superbuilder-feature-dev-types";

const execFile = promisify(execFileCb);

const DEFAULT_OPTS: Required<
	Pick<FeatureDevOptions, "approvalMode" | "agent" | "skipVerify" | "skipRegister">
> = {
	approvalMode: true,
	agent: "claude",
	skipVerify: false,
	skipRegister: false,
};

/**
 * Superbuilder Feature Dev Pipeline.
 *
 * Orchestrates the full feature development lifecycle:
 * spec → plan → [approval] → worktree → implement → verify → [approval] → register → [approval] → complete
 */
export async function superbuilderFeatureDevPipeline(
	input: FeatureDevInput,
	callbacks?: FeatureDevCallbacks,
): Promise<FeatureDevResult> {
	const opts = { ...DEFAULT_OPTS, ...input.options };
	const cb = callbacks ?? input.callbacks;
	const worktreeBase = opts.worktreeBasePath ?? join(
		process.env.HOME ?? "/tmp",
		".superbuilder",
		"worktrees",
	);

	let featureName = input.featureName ?? "";
	let spec = "";
	let plan = "";
	let worktreePath = "";
	let branchName = "";
	let prUrl = "";
	let verifyPassed = false;

	// ── Step 1: generateSpec (FATAL) ─────────────────────────────
	cb?.onStep?.("generateSpec", "start", "Spec 생성 중...");
	try {
		spec = await spawnClaude(
			input.boilerplatePath,
			buildSpecPrompt(input.prompt),
			opts.agent,
		);

		if (!featureName) {
			// spec에서 feature name 추출 시도
			const nameMatch = spec.match(/feature[_-]?name\s*[:=]\s*["']?([a-z][a-z0-9-]*)/i);
			featureName = nameMatch?.[1] ?? `feature-${Date.now().toString(36).slice(-6)}`;
		}

		cb?.onStep?.("generateSpec", "done", `Spec 생성 완료 (${spec.length} chars)`);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		cb?.onStep?.("generateSpec", "error", msg);
		throw e;
	}

	// ── Step 2: generatePlan (FATAL) ─────────────────────────────
	cb?.onStep?.("generatePlan", "start", "Plan 생성 중...");
	try {
		plan = await spawnClaude(
			input.boilerplatePath,
			buildPlanPrompt(spec, featureName),
			opts.agent,
		);
		cb?.onStep?.("generatePlan", "done", `Plan 생성 완료 (${plan.length} chars)`);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		cb?.onStep?.("generatePlan", "error", msg);
		throw e;
	}

	// ── Approval Gate: spec_plan ──────────────────────────────────
	if (opts.approvalMode && cb?.onApproval) {
		const decision = await cb.onApproval("spec_plan", {
			featureRequestId: "",
			type: "spec_plan",
			artifacts: [
				{ kind: "spec", content: spec },
				{ kind: "plan", content: plan },
			],
		});
		if (decision === "rejected") {
			return { featureName, status: "rejected_at_spec", spec, plan };
		}
	}

	// ── Step 3: createWorktree (FATAL) ───────────────────────────
	cb?.onStep?.("createWorktree", "start", "Git worktree 생성 중...");
	try {
		branchName = `feature/${featureName}`;
		worktreePath = join(worktreeBase, featureName);

		if (!existsSync(worktreeBase)) {
			mkdirSync(worktreeBase, { recursive: true });
		}

		await execFile("git", ["worktree", "add", worktreePath, "-b", branchName], {
			cwd: input.boilerplatePath,
			timeout: 30_000,
		});

		cb?.onStep?.("createWorktree", "done", `Worktree: ${worktreePath}`);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		cb?.onStep?.("createWorktree", "error", msg);
		throw e;
	}

	// ── Step 4: implement (NON-FATAL) ────────────────────────────
	cb?.onStep?.("implement", "start", "Feature 구현 중 (CLI agent)...");
	try {
		await spawnClaude(
			worktreePath,
			buildImplementPrompt(featureName, plan),
			opts.agent,
		);
		cb?.onStep?.("implement", "done", "구현 완료");
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		cb?.onStep?.("implement", "error", msg);
		cb?.onLog?.("구현 실패 — worktree에서 수동 작업 필요");
	}

	// ── Step 5: verify (NON-FATAL) ───────────────────────────────
	if (!opts.skipVerify) {
		cb?.onStep?.("verify", "start", "검증 중 (typecheck + lint)...");
		try {
			await execFile("bun", ["run", "typecheck"], {
				cwd: worktreePath,
				timeout: 120_000,
			});
			await execFile("bun", ["run", "lint"], {
				cwd: worktreePath,
				timeout: 60_000,
			});
			verifyPassed = true;
			cb?.onStep?.("verify", "done", "typecheck + lint 통과");
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			cb?.onStep?.("verify", "error", msg);
			cb?.onLog?.("검증 실패 — 수동 수정 필요");
		}
	} else {
		cb?.onStep?.("verify", "skip");
	}

	// ── Approval Gate: human_qa ───────────────────────────────────
	if (opts.approvalMode && cb?.onApproval) {
		const decision = await cb.onApproval("human_qa", {
			featureRequestId: "",
			type: "human_qa",
			summary: `Feature: ${featureName}, Verify: ${verifyPassed ? "PASS" : "FAIL"}, Worktree: ${worktreePath}`,
		});
		if (decision === "rejected") {
			return { featureName, status: "rejected_at_qa", spec, plan, worktreePath, branchName, verifyPassed };
		}
	}

	// ── Step 6: register (NON-FATAL) ─────────────────────────────
	if (!opts.skipRegister) {
		cb?.onStep?.("register", "start", "Boilerplate PR 생성 중...");
		try {
			// Push branch and create PR
			await execFile("git", ["push", "origin", branchName], {
				cwd: worktreePath,
				timeout: 60_000,
			});

			const { stdout: prUrlRaw } = await execFile(
				"gh",
				["pr", "create", "--base", "develop", "--title", `feat: add ${featureName} feature`, "--body", `Auto-generated by superbuilder-feature-dev pipeline.\n\nSpec:\n${spec.slice(0, 500)}...`],
				{ cwd: worktreePath, timeout: 30_000 },
			);
			prUrl = prUrlRaw.trim();

			cb?.onStep?.("register", "done", `PR: ${prUrl}`);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			cb?.onStep?.("register", "error", msg);
			cb?.onLog?.("PR 생성 실패 — 수동 생성 필요");
		}
	} else {
		cb?.onStep?.("register", "skip");
	}

	// ── Approval Gate: registration ──────────────────────────────
	if (!opts.skipRegister && prUrl && opts.approvalMode && cb?.onApproval) {
		const decision = await cb.onApproval("registration", {
			featureRequestId: "",
			type: "registration",
			summary: `PR: ${prUrl}`,
		});
		if (decision === "rejected") {
			// Close PR
			try {
				await execFile("gh", ["pr", "close", prUrl], {
					cwd: worktreePath,
					timeout: 15_000,
				});
			} catch {}
			return { featureName, status: "rejected_at_registration", spec, plan, worktreePath, branchName, prUrl, verifyPassed };
		}
	}

	// ── Step 7: complete (NON-FATAL) ─────────────────────────────
	if (!opts.skipRegister && prUrl) {
		cb?.onStep?.("complete", "start", "PR merge 중...");
		try {
			await execFile("gh", ["pr", "merge", prUrl, "--merge", "--delete-branch"], {
				cwd: worktreePath,
				timeout: 30_000,
			});
			cb?.onStep?.("complete", "done", "PR 머지 완료");
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			cb?.onStep?.("complete", "error", msg);
			cb?.onLog?.("PR 머지 실패 — 수동 머지 필요");
		}
	}

	// ── Step 8: cleanup (NON-FATAL) ──────────────────────────────
	cb?.onStep?.("cleanup", "start", "Worktree 정리 중...");
	try {
		await execFile("git", ["worktree", "remove", worktreePath, "--force"], {
			cwd: input.boilerplatePath,
			timeout: 15_000,
		});
		cb?.onStep?.("cleanup", "done", "정리 완료");
	} catch {
		cb?.onStep?.("cleanup", "error", "worktree 삭제 실패 (수동 삭제 필요)");
	}

	cb?.onLog?.("파이프라인 완료");

	return {
		featureName,
		status: "registered",
		spec,
		plan,
		worktreePath,
		branchName,
		prUrl,
		verifyPassed,
	};
}

// ─── Helper: spawn claude/codex CLI ──────────────────────────────

async function spawnClaude(
	cwd: string,
	prompt: string,
	agent: "claude" | "codex" = "claude",
): Promise<string> {
	const cmd = agent === "codex" ? "codex" : "claude";
	const args =
		agent === "codex"
			? ["--dangerously-bypass-approvals-and-sandbox", "--", prompt]
			: ["--dangerously-skip-permissions", "-p", prompt, "--output-format", "text"];

	const { stdout } = await execFile(cmd, args, {
		cwd,
		timeout: 600_000, // 10 minutes
		maxBuffer: 10 * 1024 * 1024, // 10MB
	});

	return stdout.trim();
}

// ─── Helper: prompt builders ─────────────────────────────────────

function buildSpecPrompt(userPrompt: string): string {
	return [
		"You are a feature architect for the Superbuilder platform.",
		"Analyze the following feature request and produce a detailed spec.",
		"",
		"Include:",
		"- feature_name: kebab-case identifier",
		"- Summary",
		"- Server components (NestJS modules, controllers, services)",
		"- Client components (React pages, hooks)",
		"- Database schema (Drizzle tables)",
		"- Dependencies on other features",
		"- API endpoints",
		"",
		"Format as structured markdown.",
		"",
		"--- Feature Request ---",
		userPrompt,
	].join("\n");
}

function buildPlanPrompt(spec: string, featureName: string): string {
	return [
		"You are a feature developer for the Superbuilder platform.",
		`Create a step-by-step implementation plan for the "${featureName}" feature.`,
		"",
		"The plan should include:",
		"- Exact file paths to create",
		"- Code for each file",
		"- feature.json manifest",
		"- Marker block insertions",
		"- Test plan",
		"",
		"--- Feature Spec ---",
		spec,
	].join("\n");
}

function buildImplementPrompt(featureName: string, plan: string): string {
	return [
		`Implement the "${featureName}" feature according to the plan below.`,
		"",
		"Rules:",
		`- Create feature code in packages/features/${featureName}/`,
		"- Create feature.json manifest",
		"- Insert marker blocks in app.module.ts, router.tsx etc.",
		"- Update superbuilder.json",
		"- Run typecheck and fix errors",
		"- Commit all changes with descriptive messages",
		"- Push to the current branch",
		"",
		"--- Implementation Plan ---",
		plan,
	].join("\n");
}
```

- [ ] **Step 2: index.ts에 export 추가**

`packages/atlas-engine/src/pipeline/index.ts`에 추가:
```typescript
export { superbuilderFeatureDevPipeline } from "./superbuilder-feature-dev";
export * from "./superbuilder-feature-dev-types";
```

- [ ] **Step 3: 타입체크**

Run: `bun run typecheck --filter=@superbuilder/atlas-engine`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/atlas-engine/src/pipeline/superbuilder-feature-dev.ts packages/atlas-engine/src/pipeline/superbuilder-feature-dev-types.ts packages/atlas-engine/src/pipeline/index.ts
git commit -m "feat(atlas-engine): add superbuilderFeatureDevPipeline orchestrator"
```

---

## Chunk 3: CLI 커맨드

### Task 5: `/superbuilder-feature-dev` 커맨드

**Files:**
- Create: `.agents/commands/superbuilder-feature-dev.md`

- [ ] **Step 1: 커맨드 작성**

```markdown
---
description: Feature 개발 파이프라인 — spec 생성 → plan → worktree → 구현 → 검증 → 등록까지 한 번에 실행
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# superbuilder-feature-dev: Feature 개발 파이프라인

Desktop UI 없이 CLI에서 직접 feature를 개발한다.
`@superbuilder/atlas-engine`의 `superbuilderFeatureDevPipeline()` 함수를 호출하여 전체 흐름을 실행.

## 사용법

### 대화형 모드 (인자 없음)

```
/superbuilder-feature-dev
```

### 비대화형 모드

```
/superbuilder-feature-dev --prompt "블로그 댓글 기능" --name comment --path ~/boilerplate
/superbuilder-feature-dev --prompt "결제 기능" --no-approval --agent codex
```

## 대화형 흐름

### Step 1: 승인 모드 선택

```
승인 게이트를 사용하시겠습니까?
  [Y] 예 — 각 단계에서 확인 후 진행 (기본)
  [N] 아니오 — 전체 자동 실행
```

### Step 2: Feature 요청 입력

```
어떤 feature를 만들까요?
> 블로그에 댓글 기능을 추가해주세요. 대댓글, 좋아요, 신고 기능 포함.
```

### Step 3: 파이프라인 실행

`superbuilderFeatureDevPipeline()`을 호출한다.

각 단계 진행 상황을 출력:

```
🚀 Feature 개발 중...
  ✅ Spec 생성 완료 (2,340 chars)
  ✅ Plan 생성 완료 (5,120 chars)
  ⏸ [승인] Spec & Plan을 확인하세요. 계속 진행? (Y/N)
  ✅ Worktree 생성: ~/.superbuilder/worktrees/comment
  ✅ 구현 완료
  ✅ typecheck + lint 통과
  ⏸ [승인] 구현 결과를 확인하세요. 계속 진행? (Y/N)
  ✅ PR 생성: https://github.com/.../pull/42
  ⏸ [승인] PR을 확인하세요. 머지? (Y/N)
  ✅ PR 머지 완료
  ✅ Worktree 정리 완료

Feature 등록 완료: comment
```

## CLI 인자

| 인자 | 설명 | 필수 |
|------|------|------|
| `--prompt` | Feature 요청 텍스트 | 필수 |
| `--name` | Feature 이름 (미지정 시 AI 생성) | 선택 |
| `--path` | Boilerplate repo 경로 | 선택 (BOILERPLATE_PATH env) |
| `--no-approval` | 승인 게이트 건너뛰기 | 선택 |
| `--agent` | claude 또는 codex (기본: claude) | 선택 |
| `--skip-verify` | 검증 건너뛰기 | 선택 |
| `--skip-register` | 등록 건너뛰기 | 선택 |

## 환경변수

| 변수 | 용도 |
|------|------|
| `BOILERPLATE_PATH` | boilerplate repo 로컬 경로 |
| `SUPERBUILDER_FEATURES_PATH` | superbuilder-features 로컬 경로 |

## 기술 참조

- 파이프라인 함수: `@superbuilder/atlas-engine`의 `superbuilderFeatureDevPipeline()`
- 스펙: `docs/superpowers/specs/2026-03-15-feature-dev-pipeline-design.md`

$ARGUMENTS
```

- [ ] **Step 2: Commit**

```bash
git add .agents/commands/superbuilder-feature-dev.md
git commit -m "feat: add /superbuilder-feature-dev CLI command"
```

---

### Task 6: `/superbuilder-feature-verify` E2E 검증 커맨드

**Files:**
- Create: `.agents/commands/superbuilder-feature-verify.md`

- [ ] **Step 1: 커맨드 작성**

```markdown
---
description: Feature Dev 파이프라인 E2E 검증 — spec 생성부터 PR 머지까지 전체 파이프라인 자동 실행 + 체크포인트 검증
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# superbuilder-feature-verify: Feature Dev E2E 검증

superbuilderFeatureDevPipeline()의 전체 흐름을 실제로 실행하여 검증한다.
간단한 테스트용 feature를 생성하고, 각 체크포인트를 검증한 뒤, 생성된 리소스를 정리한다.
**통과할 때까지 반복한다.**

## 테스트 설정

| 항목 | 값 |
|------|-----|
| Prompt | "간단한 인사말 표시 feature" |
| Feature name | `verify-test-{timestamp}` |
| Boilerplate path | `$BOILERPLATE_PATH` 또는 사용자 입력 |
| Approval mode | false (자동) |

## 실행 절차

### Step 1: 파이프라인 실행

superbuilderFeatureDevPipeline()을 호출하는 스크립트를 작성하고 실행:

```typescript
import { superbuilderFeatureDevPipeline } from "@superbuilder/atlas-engine";

const timestamp = Date.now().toString(36).slice(-6);
const featureName = `verify-test-${timestamp}`;

const result = await superbuilderFeatureDevPipeline({
  prompt: "간단한 인사말 표시 feature. HelloVerify 컴포넌트 하나와 GET /api/verify-hello 엔드포인트 하나.",
  featureName,
  boilerplatePath: process.env.BOILERPLATE_PATH!,
  options: {
    approvalMode: false,
    skipRegister: true, // PR 생성은 건너뜀 (테스트 환경)
  },
}, {
  onStep: (step, status, msg) => console.log(`[${step}] ${status}: ${msg ?? ""}`),
  onLog: (msg) => console.log(msg),
});

console.log("=== RESULT ===");
console.log(JSON.stringify(result, null, 2));
```

실행:
```bash
cd /Users/bbright/Projects/superbuilder && bun run /tmp/superbuilder-feature-verify-runner.ts
```

### Step 2: 체크포인트 검증

| # | 체크포인트 | 검증 방법 | 기대 결과 |
|---|-----------|----------|----------|
| 1 | spec 생성 | `result.spec`이 비어있지 않음 | 100자 이상 |
| 2 | plan 생성 | `result.plan`이 비어있지 않음 | 100자 이상 |
| 3 | worktree 생성 | `ls {result.worktreePath}` | 디렉토리 존재 |
| 4 | feature 디렉토리 | `ls {worktree}/packages/features/{name}/` | 디렉토리 존재 |
| 5 | feature.json | `cat {worktree}/packages/features/{name}/feature.json` | 유효한 JSON |
| 6 | typecheck | `result.verifyPassed` | true |
| 7 | git commits | `git -C {worktree} log --oneline` | 1개 이상 commit |

### Step 3: Cleanup

```bash
# Worktree 삭제
git -C $BOILERPLATE_PATH worktree remove {worktreePath} --force
git -C $BOILERPLATE_PATH branch -D feature/{featureName}

# 임시 파일 삭제
rm -f /tmp/superbuilder-feature-verify-runner.ts
```

## 실패 시 대응

| 실패 단계 | 확인 사항 |
|----------|----------|
| spec/plan 생성 | claude CLI 설치 확인 (`which claude`), ANTHROPIC_API_KEY 확인 |
| worktree | boilerplate 경로 확인, git 상태 확인 (`git status`) |
| implement | worktree에서 수동 `claude` 실행하여 에러 확인 |
| verify | worktree에서 `bun run typecheck` 수동 실행 |

$ARGUMENTS
```

- [ ] **Step 2: Commit**

```bash
git add .agents/commands/superbuilder-feature-verify.md
git commit -m "feat: add /superbuilder-feature-verify E2E test command"
```

---

### Task 7: Desktop feature-studio proxy 업데이트

**Files:**
- Modify: `apps/desktop/src/lib/trpc/routers/atlas/feature-studio.ts`

- [ ] **Step 1: 새 프로시저 6개 proxy 추가**

기존 `registerRequest` 뒤에 추가:

```typescript
		appendMessage: publicProcedure
			.input(
				z.object({
					featureRequestId: z.string().uuid(),
					role: z.enum(["system", "assistant", "user"]),
					content: z.string().min(1),
					kind: z.enum(["conversation", "event", "note"]).optional(),
					metadata: z.record(z.string(), z.unknown()).optional(),
				}),
			)
			.mutation(async ({ input }) => {
				return apiClient.featureStudio.appendMessage.mutate(input);
			}),

		saveArtifact: publicProcedure
			.input(
				z.object({
					featureRequestId: z.string().uuid(),
					kind: z.enum(["spec", "plan", "implementation_summary", "verification_report", "agent_qa_report", "human_qa_notes", "registration_manifest", "preview_metadata"]),
					content: z.string().min(1),
					version: z.number().int().positive().optional(),
					metadata: z.record(z.string(), z.unknown()).optional(),
				}),
			)
			.mutation(async ({ input }) => {
				return apiClient.featureStudio.saveArtifact.mutate(input);
			}),

		updateStatus: publicProcedure
			.input(
				z.object({
					featureRequestId: z.string().uuid(),
					status: z.enum([
						"draft", "spec_ready", "pending_spec_approval", "plan_approved",
						"implementing", "verifying", "preview_deploying", "agent_qa",
						"pending_human_qa", "customization", "pending_registration",
						"registered", "failed", "discarded",
					]),
					errorMessage: z.string().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				return apiClient.featureStudio.updateStatus.mutate(input);
			}),

		saveWorktree: publicProcedure
			.input(
				z.object({
					featureRequestId: z.string().uuid(),
					worktreePath: z.string().min(1),
					branchName: z.string().min(1),
					baseBranch: z.string().default("develop"),
				}),
			)
			.mutation(async ({ input }) => {
				return apiClient.featureStudio.saveWorktree.mutate(input);
			}),

		createRun: publicProcedure
			.input(
				z.object({
					featureRequestId: z.string().uuid(),
					workflowName: z.string().min(1),
					workflowStep: z.string().min(1),
				}),
			)
			.mutation(async ({ input }) => {
				return apiClient.featureStudio.createRun.mutate(input);
			}),

		updateRun: publicProcedure
			.input(
				z.object({
					runId: z.string().uuid(),
					status: z.enum(["queued", "running", "paused", "completed", "failed", "cancelled"]),
					lastError: z.string().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				return apiClient.featureStudio.updateRun.mutate(input);
			}),
```

- [ ] **Step 2: 타입체크**

Run: Desktop dev 서버 실행 시 빌드 에러 없는지 확인

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/trpc/routers/atlas/feature-studio.ts
git commit -m "feat(desktop): add missing feature-studio proxy procedures"
```

---

### Task 8: 문서 업데이트

**Files:**
- Modify: `docs/architecture/subsystems/agent-commands-reference.md`

- [ ] **Step 1: 커맨드 레퍼런스에 추가**

Feature 라이프사이클 섹션에 추가:

```markdown
| `/superbuilder-feature-dev` | Feature 개발 파이프라인 — spec → plan → worktree → 구현 → 검증 → 등록 |
| `/superbuilder-feature-verify` | Feature Dev E2E 검증 — 전체 파이프라인 자동 실행 + 체크포인트 검증 |
```

- [ ] **Step 2: Commit + Push**

```bash
git add docs/architecture/subsystems/agent-commands-reference.md
git commit -m "docs: add superbuilder-feature-dev and verify commands to reference"
git push origin develop
```
