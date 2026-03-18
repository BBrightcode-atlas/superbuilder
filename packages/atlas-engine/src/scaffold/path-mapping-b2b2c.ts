import { join } from "node:path";

/** B2B2C에서 사용하는 slot — client 제외, landing 추가 */
export type B2B2CPathSlot =
	| "server"
	| "admin"
	| "schema"
	| "widgets"
	| "landing";

interface PathEntry {
	from: string;
	to: string;
}

export const B2B2C_PATH_MAPPING: Record<B2B2CPathSlot, PathEntry> = {
	server: { from: "src/server", to: "packages/features" },
	admin: { from: "src/admin", to: "apps/admin/src/features" },
	schema: { from: "src/schema", to: "packages/drizzle/src/schema/features" },
	widgets: { from: "src/widget", to: "packages/widgets/src" },
	landing: { from: "src/landing", to: "apps/landing/src/features" },
};

export function resolveB2B2CSourcePath(
	featuresRepoPath: string,
	featureId: string,
	slot: B2B2CPathSlot,
): string {
	return join(featuresRepoPath, featureId, B2B2C_PATH_MAPPING[slot].from);
}

export function resolveB2B2CTargetPath(
	projectDir: string,
	featureId: string,
	slot: B2B2CPathSlot,
): string {
	return join(projectDir, B2B2C_PATH_MAPPING[slot].to, featureId);
}
