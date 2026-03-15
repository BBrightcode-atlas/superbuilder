import type { Provides } from "../manifest/types";
import type { DerivedConnections } from "./types";

export function deriveConnections(
	featureId: string,
	provides: Provides,
): DerivedConnections {
	const conn: DerivedConnections = {};

	if (provides.server) {
		const { module, router, routerKey } = provides.server;
		conn.nestModuleImport = `import { ${module} } from "@repo/features/${featureId}";`;
		conn.nestModuleRef = `${module},`;
		conn.trpcRouterImport = `import { ${router} } from "@repo/features/${featureId}";`;
		conn.trpcRouterKey = `${routerKey}: ${router},`;
		conn.trpcTypeImport = `import { ${router} } from "./${featureId}";`;
		conn.trpcTypeKey = `${routerKey}: ${router},`;
	}

	if (provides.client) {
		const { routes } = provides.client;
		conn.clientRoutesImport = `import { ${routes} } from "@/features/${featureId}";`;
		conn.clientRoutesSpread = `...${routes}(appLayoutRoute),`;
	}

	if (provides.admin) {
		const { routes, menu } = provides.admin;
		conn.adminRoutesImport = `import { ${routes} } from "./features/${featureId}";`;
		conn.adminRoutesSpread = `...${routes}(adminLayoutRoute),`;
		if (menu) {
			conn.adminMenu = JSON.stringify({
				id: featureId,
				...menu,
				path: `/${featureId}`,
			});
		}
	}

	if (provides.schema) {
		const { tables } = provides.schema;
		conn.schemaExport = `export * from "./features/${featureId}";`;
		conn.tablesFilter = tables.map((t) => `"${t}"`).join(", ");
	}

	if (provides.widget) {
		conn.widgetExport = {
			subpath: `./${featureId}`,
			entry: `./src/${featureId}/index.ts`,
		};
	}

	return conn;
}
