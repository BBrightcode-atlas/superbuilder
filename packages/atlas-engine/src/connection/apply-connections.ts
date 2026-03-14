import { join } from "node:path";
import type { FeatureManifest } from "../manifest/types";
import { insertAtMarker } from "./applier";
import { deriveConnections } from "./deriver";
import type { DerivedConnections } from "./types";
import { registerWidgetExport } from "./widget-export";

interface MarkerTarget {
	file: string;
	marker: string;
}

const MARKER_MAP: Record<string, MarkerTarget> = {
	nestModuleImport: {
		file: "apps/server/src/app.module.ts",
		marker: "IMPORTS",
	},
	nestModuleRef: {
		file: "apps/server/src/app.module.ts",
		marker: "MODULES",
	},
	trpcRouterImport: {
		file: "apps/server/src/trpc/router.ts",
		marker: "IMPORTS",
	},
	trpcRouterKey: {
		file: "apps/server/src/trpc/router.ts",
		marker: "ROUTERS",
	},
	trpcTypeImport: {
		file: "packages/features/app-router.ts",
		marker: "IMPORTS",
	},
	trpcTypeKey: {
		file: "packages/features/app-router.ts",
		marker: "ROUTERS",
	},
	clientRoutesImport: {
		file: "apps/app/src/router.tsx",
		marker: "IMPORTS",
	},
	clientRoutesSpread: {
		file: "apps/app/src/router.tsx",
		marker: "ROUTES",
	},
	adminRoutesImport: {
		file: "apps/admin/src/router.tsx",
		marker: "IMPORTS",
	},
	adminRoutesSpread: {
		file: "apps/admin/src/router.tsx",
		marker: "ADMIN_ROUTES",
	},
	schemaExport: {
		file: "packages/drizzle/src/schema/index.ts",
		marker: "SCHEMA_EXPORTS",
	},
};

/**
 * Derive connections from a feature manifest and apply them to template files
 * by inserting content at ATLAS marker blocks.
 */
export function applyConnections(
	templateDir: string,
	manifest: FeatureManifest,
): void {
	const connections = deriveConnections(manifest.id, manifest.provides);

	for (const [field, target] of Object.entries(MARKER_MAP)) {
		const value = connections[field as keyof DerivedConnections];
		if (typeof value === "string") {
			const filePath = join(templateDir, target.file);
			insertAtMarker(filePath, target.marker, value);
		}
	}

	if (connections.widgetExport) {
		registerWidgetExport(templateDir, manifest.id, connections.widgetExport);
	}
}
