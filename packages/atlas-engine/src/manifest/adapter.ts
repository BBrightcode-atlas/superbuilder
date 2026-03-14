import type { FeatureEntry, FeatureManifest, FeatureRegistry } from "./types";

const STANDARD_GROUPS: Record<string, { label: string; order: number }> = {
	core: { label: "코어", order: 0 },
	content: { label: "콘텐츠", order: 1 },
	commerce: { label: "커머스", order: 2 },
	community: { label: "커뮤니티", order: 3 },
	system: { label: "시스템", order: 4 },
	template: { label: "템플릿", order: 5 },
};

export function manifestsToRegistry(
	manifests: FeatureManifest[],
): FeatureRegistry {
	const features: Record<string, FeatureEntry> = {};
	const coreIds: string[] = [];

	for (const m of manifests) {
		const entry: FeatureEntry = {
			name: m.name,
			type: m.type,
			icon: m.icon,
			group: m.group,
			description: m.description,
			dependencies: m.dependencies,
			optionalDependencies: m.optionalDependencies ?? [],
			router: {
				key: m.provides.server?.routerKey ?? m.id,
				import: m.provides.server?.router ?? `${m.id}Router`,
				from: `@repo/features/${m.id}`,
			},
			server: {
				module: `packages/features/${m.id}/${m.id}.module.ts`,
			},
			client: m.provides.client
				? { app: `apps/app/src/features/${m.id}/` }
				: {},
			schema: {
				tables: m.provides.schema?.tables ?? [],
				path: `packages/drizzle/src/schema/features/${m.id}/`,
			},
		};

		if (m.provides.widget) {
			entry.widget = {
				path: `packages/widgets/src/${m.id}/`,
				export: `@repo/widgets/${m.id}`,
			};
		}

		if (m.provides.admin?.menu) {
			entry.admin = {
				showInSidebar: true,
				path: `/admin/${m.id}`,
				label: m.provides.admin.menu.label,
				order: m.provides.admin.menu.order,
			};
		}

		features[m.id] = entry;

		if (m.group === "core") {
			coreIds.push(m.id);
		}
	}

	return {
		version: "1.0.0",
		source: "feature.json",
		features,
		core: coreIds,
		groups: { ...STANDARD_GROUPS },
	};
}
