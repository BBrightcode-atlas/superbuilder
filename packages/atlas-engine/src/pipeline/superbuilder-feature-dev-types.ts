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
