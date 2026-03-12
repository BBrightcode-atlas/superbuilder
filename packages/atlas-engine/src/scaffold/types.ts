import type { FeatureRegistry } from "../registry/types";
import type { ResolvedFeatures } from "../resolver/types";

/** Database provider */
export type DatabaseProvider = "neon";

/** Auth provider */
export type AuthProvider = "better-auth";

/** Deploy provider */
export type DeployProvider = "vercel" | "none";

/** Project infrastructure config */
export interface ProjectConfig {
	database: {
		provider: DatabaseProvider;
		projectId?: string | null;
		connectionString?: string | null;
	};
	auth: {
		provider: AuthProvider;
		features: string[];
	};
	deploy: {
		provider: DeployProvider;
		teamId?: string | null;
		projectId?: string | null;
		domain?: string | null;
	};
}

/** Path mapping between superbuilder and target project */
export interface PathMapping {
	server: { from: string; to: string };
	client: { from: string; to: string };
	admin: { from: string; to: string };
	schema: { from: string; to: string };
	widgets: { from: string; to: string };
}

/** Source metadata */
export interface SourceInfo {
	type: "superbuilder";
	repo: string;
	branch: string;
	templateRepo: string;
	templateVersion: string;
	createdAt: string;
}

/** Feature install status */
export interface InstalledFeature {
	version: string;
	installedAt: string;
	status: "installed" | "failed" | "pending";
}

/** superbuilder.json — the project spec */
export interface ProjectSpec {
	name: string;
	version: string;
	description: string;
	source: SourceInfo;
	config: ProjectConfig;
	features: {
		selected: string[];
		resolved: string[];
		autoIncluded: string[];
	};
	installed: Record<string, InstalledFeature>;
	pathMapping: PathMapping;
}

/** Scaffold engine input */
export interface ScaffoldInput {
	projectName: string;
	targetDir: string;
	description?: string;
	config: ProjectConfig;
	resolved: ResolvedFeatures;
	registry: FeatureRegistry;
	sourceRepoPath: string;
}

/** Scaffold engine output */
export interface ScaffoldResult {
	projectDir: string;
	spec: ProjectSpec;
}
