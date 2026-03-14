import { describe, it, expect } from "bun:test";
import { manifestsToRegistry } from "./adapter";
import type { FeatureManifest } from "./types";

function makeManifest(
	overrides: Partial<FeatureManifest> = {},
): FeatureManifest {
	return {
		id: "blog",
		name: "Blog",
		version: "1.0.0",
		type: "page",
		group: "content",
		icon: "pen",
		description: "Blog feature",
		dependencies: [],
		optionalDependencies: [],
		provides: {},
		...overrides,
	};
}

describe("manifestsToRegistry", () => {
	it("converts manifests to FeatureRegistry format", () => {
		const manifests = [makeManifest()];
		const registry = manifestsToRegistry(manifests);

		expect(registry.version).toBe("1.0.0");
		expect(registry.source).toBe("feature.json");
		expect(registry.features).toBeDefined();
		expect(registry.features.blog).toBeDefined();
		expect(registry.features.blog.name).toBe("Blog");
	});

	it("maps server provides to router and server paths", () => {
		const manifests = [
			makeManifest({
				provides: {
					server: {
						module: "BlogModule",
						router: "blogRouter",
						routerKey: "blog",
					},
				},
			}),
		];
		const registry = manifestsToRegistry(manifests);
		const entry = registry.features.blog;

		expect(entry.router).toEqual({
			key: "blog",
			import: "blogRouter",
			from: "@repo/features/blog",
		});
		expect(entry.server).toEqual({
			module: "packages/features/blog/blog.module.ts",
		});
	});

	it("maps client provides to client paths", () => {
		const manifests = [
			makeManifest({
				provides: {
					client: {
						routes: "createBlogRoutes",
					},
				},
			}),
		];
		const registry = manifestsToRegistry(manifests);
		const entry = registry.features.blog;

		expect(entry.client).toEqual({
			app: "apps/app/src/features/blog/",
		});
	});

	it("maps admin provides to admin config", () => {
		const manifests = [
			makeManifest({
				provides: {
					admin: {
						routes: "createBlogAdminRoutes",
						menu: {
							label: "Blog",
							icon: "pen",
							order: 10,
						},
					},
				},
			}),
		];
		const registry = manifestsToRegistry(manifests);
		const entry = registry.features.blog;

		expect(entry.admin).toEqual({
			showInSidebar: true,
			path: "/admin/blog",
			label: "Blog",
			order: 10,
		});
	});

	it("maps schema provides to schema paths", () => {
		const manifests = [
			makeManifest({
				provides: {
					schema: {
						tables: ["posts", "post_tags"],
					},
				},
			}),
		];
		const registry = manifestsToRegistry(manifests);
		const entry = registry.features.blog;

		expect(entry.schema).toEqual({
			tables: ["posts", "post_tags"],
			path: "packages/drizzle/src/schema/features/blog/",
		});
	});

	it("maps widget provides to widget paths", () => {
		const manifests = [
			makeManifest({
				provides: {
					widget: {
						component: "BlogWidget",
						props: ["postId"],
					},
				},
			}),
		];
		const registry = manifestsToRegistry(manifests);
		const entry = registry.features.blog;

		expect(entry.widget).toEqual({
			path: "packages/widgets/src/blog/",
			export: "@repo/widgets/blog",
		});
	});

	it("preserves dependencies", () => {
		const manifests = [
			makeManifest({
				dependencies: ["auth", "file-manager"],
				optionalDependencies: ["review"],
			}),
		];
		const registry = manifestsToRegistry(manifests);
		const entry = registry.features.blog;

		expect(entry.dependencies).toEqual(["auth", "file-manager"]);
		expect(entry.optionalDependencies).toEqual(["review"]);
	});

	it("includes standard groups", () => {
		const manifests = [makeManifest()];
		const registry = manifestsToRegistry(manifests);

		expect(registry.groups.core).toBeDefined();
		expect(registry.groups.content).toBeDefined();
		expect(registry.groups.commerce).toBeDefined();
		expect(registry.groups.community).toBeDefined();
		expect(registry.groups.system).toBeDefined();
		expect(registry.groups.template).toBeDefined();
	});

	it("returns empty registry for empty input", () => {
		const registry = manifestsToRegistry([]);

		expect(registry.version).toBe("1.0.0");
		expect(registry.source).toBe("feature.json");
		expect(registry.features).toEqual({});
		expect(registry.core).toEqual([]);
	});

	it("populates core array with core-group features", () => {
		const manifests = [
			makeManifest({ id: "auth", name: "Auth", group: "core" }),
			makeManifest({ id: "blog", name: "Blog", group: "content" }),
		];
		const registry = manifestsToRegistry(manifests);

		expect(registry.core).toEqual(["auth"]);
	});
});
