import { join } from "node:path";

/** Slot names for feature-json path mapping */
export type PathSlot = "server" | "client" | "admin" | "schema" | "widgets";

interface PathEntry {
	from: string;
	to: string;
}

/** Path mapping type */
export type PathMapping = Record<PathSlot, PathEntry>;

/**
 * Feature-json source path mapping.
 *
 * Maps feature package entrypoint directories to target project paths.
 * Used when the source is superbuilder-features/features/{name}/src/*
 * instead of the legacy boilerplate-internal paths.
 */
export const FEATURE_JSON_PATH_MAPPING: PathMapping = {
	server: {
		from: "src/server",
		to: "packages/features",
	},
	client: {
		from: "src/client",
		to: "apps/app/src/features",
	},
	admin: {
		from: "src/admin",
		to: "apps/admin/src/features",
	},
	schema: {
		from: "src/schema",
		to: "packages/drizzle/src/schema/features",
	},
	widgets: {
		from: "src/widget",
		to: "packages/widgets/src",
	},
};

/**
 * Resolve source path for a feature-json based feature.
 */
export function resolveFeatureJsonSourcePath(
	featuresRepoPath: string,
	featureId: string,
	slot: PathSlot,
): string {
	return join(
		featuresRepoPath,
		featureId,
		FEATURE_JSON_PATH_MAPPING[slot].from,
	);
}

/**
 * Resolve target path for a feature-json based feature.
 */
export function resolveFeatureJsonTargetPath(
	projectDir: string,
	featureId: string,
	slot: PathSlot,
): string {
	return join(projectDir, FEATURE_JSON_PATH_MAPPING[slot].to, featureId);
}
