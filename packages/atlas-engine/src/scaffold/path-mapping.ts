import { join } from "node:path";
import type { PathMapping } from "./types";

export type PathSlot = "server" | "client" | "admin" | "schema" | "widgets";

export const DEFAULT_PATH_MAPPING: PathMapping = {
	server: {
		from: "packages/features-server/features",
		to: "packages/features",
	},
	client: {
		from: "apps/features-app/src/features",
		to: "apps/app/src/features",
	},
	admin: {
		from: "apps/feature-admin/src/features",
		to: "apps/feature-admin/src/features",
	},
	schema: {
		from: "packages/features-db/src/schema/features",
		to: "packages/drizzle/src/schema/features",
	},
	widgets: {
		from: "packages/widgets/src",
		to: "packages/widgets/src",
	},
};

/** Import alias mapping (superbuilder -> target project) */
export const IMPORT_ALIAS_MAP: Record<string, string> = {
	"@superbuilder/features-server": "@repo/features",
	"@superbuilder/features-db": "@repo/drizzle",
	"@superbuilder/features-client/core": "@repo/core",
	"@superbuilder/feature-ui": "@repo/ui",
	"@superbuilder/widgets": "@repo/widgets",
};

export function resolveSourcePath(
	mapping: PathMapping,
	slot: PathSlot,
	featureName: string,
	sourceRepoPath: string,
): string {
	return join(sourceRepoPath, mapping[slot].from, featureName);
}

export function resolveTargetPath(
	mapping: PathMapping,
	slot: PathSlot,
	featureName: string,
	projectDir: string,
): string {
	return join(projectDir, mapping[slot].to, featureName);
}
