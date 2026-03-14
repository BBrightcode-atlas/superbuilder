import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FeatureManifest, Provides } from "../manifest/types";
import { copyFeaturesToTemplate } from "./copy-features";

const TEST_DIR = join(import.meta.dir, "__test_copy_fixtures__");
const SRC_DIR = join(TEST_DIR, "features-src");
const TPL_DIR = join(TEST_DIR, "template");

function createFeatureSource(id: string, slots: string[]) {
	for (const slot of slots) {
		const dir = join(SRC_DIR, id, `src/${slot}`);
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "index.ts"), `export const ${id}_${slot} = true;`);
	}
}

function makeManifest(id: string, provides: Provides): FeatureManifest {
	return {
		id,
		name: id,
		version: "1.0.0",
		type: "page",
		group: "content",
		icon: "test",
		dependencies: [],
		provides,
	};
}

beforeEach(() => {
	mkdirSync(SRC_DIR, { recursive: true });
	mkdirSync(TPL_DIR, { recursive: true });
});

afterEach(() => {
	rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("copyFeaturesToTemplate", () => {
	it("copies server slot to packages/features/{id}/", async () => {
		createFeatureSource("blog", ["server"]);
		const manifest = makeManifest("blog", {
			server: {
				module: "BlogModule",
				router: "blogRouter",
				routerKey: "blog",
			},
		});

		await copyFeaturesToTemplate({
			templateDir: TPL_DIR,
			featuresSourceDir: SRC_DIR,
			featureIds: ["blog"],
			manifests: [manifest],
		});

		expect(existsSync(join(TPL_DIR, "packages/features/blog/index.ts"))).toBe(
			true,
		);
	});

	it("copies client slot to apps/app/src/features/{id}/", async () => {
		createFeatureSource("blog", ["client"]);
		const manifest = makeManifest("blog", {
			client: { routes: "createBlogRoutes" },
		});

		await copyFeaturesToTemplate({
			templateDir: TPL_DIR,
			featuresSourceDir: SRC_DIR,
			featureIds: ["blog"],
			manifests: [manifest],
		});

		expect(
			existsSync(join(TPL_DIR, "apps/app/src/features/blog/index.ts")),
		).toBe(true);
	});

	it("copies admin slot to apps/admin/src/features/{id}/", async () => {
		createFeatureSource("blog", ["admin"]);
		const manifest = makeManifest("blog", {
			admin: { routes: "createBlogAdminRoutes" },
		});

		await copyFeaturesToTemplate({
			templateDir: TPL_DIR,
			featuresSourceDir: SRC_DIR,
			featureIds: ["blog"],
			manifests: [manifest],
		});

		expect(
			existsSync(join(TPL_DIR, "apps/admin/src/features/blog/index.ts")),
		).toBe(true);
	});

	it("copies schema slot to packages/drizzle/src/schema/features/{id}/", async () => {
		createFeatureSource("blog", ["schema"]);
		const manifest = makeManifest("blog", {
			schema: { tables: ["posts"] },
		});

		await copyFeaturesToTemplate({
			templateDir: TPL_DIR,
			featuresSourceDir: SRC_DIR,
			featureIds: ["blog"],
			manifests: [manifest],
		});

		expect(
			existsSync(
				join(TPL_DIR, "packages/drizzle/src/schema/features/blog/index.ts"),
			),
		).toBe(true);
	});

	it("copies widget slot to packages/widgets/src/{id}/", async () => {
		createFeatureSource("comment", ["widget"]);
		const manifest = makeManifest("comment", {
			widget: { component: "CommentSection" },
		});

		await copyFeaturesToTemplate({
			templateDir: TPL_DIR,
			featuresSourceDir: SRC_DIR,
			featureIds: ["comment"],
			manifests: [manifest],
		});

		expect(
			existsSync(join(TPL_DIR, "packages/widgets/src/comment/index.ts")),
		).toBe(true);
	});

	it("skips slots that don't exist in source", async () => {
		createFeatureSource("blog", ["server"]); // only server, no client
		const manifest = makeManifest("blog", {
			server: {
				module: "BlogModule",
				router: "blogRouter",
				routerKey: "blog",
			},
			client: { routes: "createBlogRoutes" }, // manifest says client exists, but src dir doesn't
		});

		await copyFeaturesToTemplate({
			templateDir: TPL_DIR,
			featuresSourceDir: SRC_DIR,
			featureIds: ["blog"],
			manifests: [manifest],
		});

		expect(existsSync(join(TPL_DIR, "packages/features/blog/index.ts"))).toBe(
			true,
		);
		expect(existsSync(join(TPL_DIR, "apps/app/src/features/blog"))).toBe(false);
	});

	it("copies multiple features", async () => {
		createFeatureSource("blog", ["server", "client"]);
		createFeatureSource("comment", ["server", "widget"]);

		await copyFeaturesToTemplate({
			templateDir: TPL_DIR,
			featuresSourceDir: SRC_DIR,
			featureIds: ["blog", "comment"],
			manifests: [
				makeManifest("blog", {
					server: {
						module: "BlogModule",
						router: "blogRouter",
						routerKey: "blog",
					},
					client: { routes: "createBlogRoutes" },
				}),
				makeManifest("comment", {
					server: {
						module: "CommentModule",
						router: "commentRouter",
						routerKey: "comment",
					},
					widget: { component: "CommentSection" },
				}),
			],
		});

		expect(existsSync(join(TPL_DIR, "packages/features/blog/index.ts"))).toBe(
			true,
		);
		expect(
			existsSync(join(TPL_DIR, "apps/app/src/features/blog/index.ts")),
		).toBe(true);
		expect(
			existsSync(join(TPL_DIR, "packages/features/comment/index.ts")),
		).toBe(true);
		expect(
			existsSync(join(TPL_DIR, "packages/widgets/src/comment/index.ts")),
		).toBe(true);
	});
});
