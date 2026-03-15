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

export type GenerateKind = "spec" | "plan" | "implement";

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
	/**
	 * AI 작업 콜백. 호출자(현재 agent)가 직접 수행.
	 * - "spec": prompt를 받아 spec 텍스트 반환
	 * - "plan": spec을 받아 plan 텍스트 반환
	 * - "implement": plan을 받아 worktree에서 코드 구현 (반환값 무시)
	 */
	onGenerate?: (
		kind: GenerateKind,
		input: string,
		featureName: string,
	) => Promise<string>;
}

export interface FeatureDevOptions {
	approvalMode?: boolean;
	skipVerify?: boolean;
	skipRegister?: boolean;
	worktreeBasePath?: string;
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
