import { join } from "node:path";
import type { FeatureManifest } from "../manifest/types";
import { insertAtMarker } from "./applier";
import {
	type B2B2CDerivedConnections,
	deriveConnectionsB2B2C,
} from "./deriver-b2b2c";
import { registerWidgetExport } from "./widget-export";

interface MarkerTarget {
	file: string;
	marker: string;
}

/**
 * B2B2C 마커 맵.
 * SaaS 마커에서 client 제외 + landing 추가.
 */
const B2B2C_MARKER_MAP: Record<string, MarkerTarget> = {
	// Server (동일)
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
	// Admin (동일)
	adminRoutesImport: {
		file: "apps/system-admin/src/router.tsx",
		marker: "IMPORTS",
	},
	adminRoutesSpread: {
		file: "apps/system-admin/src/router.tsx",
		marker: "ADMIN_ROUTES",
	},
	// Schema (동일)
	schemaExport: {
		file: "packages/drizzle/src/schema/index.ts",
		marker: "SCHEMAS",
	},
	tablesFilter: {
		file: "packages/drizzle/drizzle.config.ts",
		marker: "TABLES",
	},
	// Landing (신규)
	landingImports: {
		file: "apps/landing/src/app/layout.tsx",
		marker: "LANDING_IMPORTS",
	},
	landingSitemap: {
		file: "apps/landing/src/app/sitemap.ts",
		marker: "LANDING_SITEMAP",
	},
	landingLlmsImports: {
		file: "apps/landing/src/app/llms.txt/route.ts",
		marker: "LANDING_LLMS_IMPORTS",
	},
	landingLlmsPages: {
		file: "apps/landing/src/app/llms.txt/route.ts",
		marker: "LANDING_LLMS_PAGES",
	},
	landingProviderImports: {
		file: "apps/landing/src/providers.tsx",
		marker: "LANDING_PROVIDER_IMPORTS",
	},
};

/**
 * B2B2C connection applicator.
 * client 마커를 제외하고, landing 마커를 추가로 처리한다.
 */
export function applyConnectionsB2B2C(
	templateDir: string,
	manifest: FeatureManifest,
): void {
	const connections = deriveConnectionsB2B2C(manifest.id, manifest.provides);

	for (const [field, target] of Object.entries(B2B2C_MARKER_MAP)) {
		const value = connections[field as keyof B2B2CDerivedConnections];
		if (typeof value === "string") {
			const filePath = join(templateDir, target.file);
			insertAtMarker(filePath, target.marker, value);
		}
	}

	if (connections.widgetExport) {
		registerWidgetExport(templateDir, manifest.id, connections.widgetExport);
	}
}
