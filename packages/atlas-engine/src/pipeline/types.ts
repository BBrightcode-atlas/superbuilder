import type { ResolvedFeatures } from "../manifest/types";

// ─────────────────────────────────────────────────────────────
// Pipeline Step tracking
// ─────────────────────────────────────────────────────────────

export type ComposeStep =
	| "resolve"
	| "scaffold"
	| "neon"
	| "github"
	| "vercel"
	| "env"
	| "install"
	| "seed";

// ─────────────────────────────────────────────────────────────
// Callbacks
// ─────────────────────────────────────────────────────────────

export interface ComposeCallbacks {
	onStep?: (
		step: ComposeStep,
		status: "start" | "done" | "skip" | "error",
		message?: string,
	) => void;
	onLog?: (message: string) => void;
}

// ─────────────────────────────────────────────────────────────
// Input / Options
// ─────────────────────────────────────────────────────────────

export interface ComposeOptions {
	neon?: boolean;
	github?: boolean;
	vercel?: boolean;
	githubOrg?: string;
	private?: boolean;
	install?: boolean;
	boilerplateRepo?: string;
	ownerEmail?: string;
	ownerPassword?: string;
	neonApiKey?: string;
	neonOrgId?: string;
	vercelToken?: string;
	vercelTeamId?: string;
}

export interface ComposeInput {
	features: string[];
	projectName: string;
	targetPath: string;
	options?: ComposeOptions;
	callbacks?: ComposeCallbacks;
}

// ─────────────────────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────────────────────

export interface NeonResult {
	projectId: string;
	databaseUrl: string;
}

export interface GitHubResult {
	repoUrl: string;
	owner: string;
	repo: string;
}

export interface VercelResult {
	projectId: string;
	deploymentUrl: string;
}

export interface SeedResult {
	systemOrgId: string;
	ownerEmail: string;
	ownerPassword: string;
}

export interface ComposeResult {
	projectDir: string;
	projectName: string;
	resolved: ResolvedFeatures;
	removedFeatures: string[];
	keptFeatures: string[];
	neon?: NeonResult;
	github?: GitHubResult;
	vercel?: VercelResult;
	installed: boolean;
	seed?: SeedResult;
}
