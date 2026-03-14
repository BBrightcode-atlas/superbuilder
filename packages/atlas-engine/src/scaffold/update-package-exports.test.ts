import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FeatureManifest, Provides } from "../manifest/types";
import { updateFeatureExports } from "./update-package-exports";

const TEST_DIR = join(import.meta.dir, "__test_exports_fixtures__");

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
	// Create packages/features/package.json
	mkdirSync(join(TEST_DIR, "packages/features"), { recursive: true });
	writeFileSync(
		join(TEST_DIR, "packages/features/package.json"),
		JSON.stringify(
			{ name: "@repo/features", exports: { ".": "./index.ts" } },
			null,
			2,
		),
	);
	// Create packages/widgets/package.json
	mkdirSync(join(TEST_DIR, "packages/widgets"), { recursive: true });
	writeFileSync(
		join(TEST_DIR, "packages/widgets/package.json"),
		JSON.stringify(
			{ name: "@repo/widgets", exports: { ".": "./src/index.ts" } },
			null,
			2,
		),
	);
});

afterEach(() => {
	rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("updateFeatureExports", () => {
	it("adds server feature export", async () => {
		const m = makeManifest("blog", {
			server: {
				module: "BlogModule",
				router: "blogRouter",
				routerKey: "blog",
			},
		});
		await updateFeatureExports(TEST_DIR, ["blog"], [m]);
		const pkg = JSON.parse(
			readFileSync(join(TEST_DIR, "packages/features/package.json"), "utf-8"),
		);
		expect(pkg.exports["./blog"]).toBe("./blog/index.ts");
	});

	it("adds widget export to widgets package", async () => {
		const m = makeManifest("comment", {
			widget: { component: "CommentSection" },
		});
		await updateFeatureExports(TEST_DIR, ["comment"], [m]);
		const pkg = JSON.parse(
			readFileSync(join(TEST_DIR, "packages/widgets/package.json"), "utf-8"),
		);
		expect(pkg.exports["./comment"]).toBe("./src/comment/index.ts");
	});

	it("preserves existing exports", async () => {
		const m = makeManifest("blog", {
			server: {
				module: "BlogModule",
				router: "blogRouter",
				routerKey: "blog",
			},
		});
		await updateFeatureExports(TEST_DIR, ["blog"], [m]);
		const pkg = JSON.parse(
			readFileSync(join(TEST_DIR, "packages/features/package.json"), "utf-8"),
		);
		expect(pkg.exports["."]).toBe("./index.ts");
		expect(pkg.exports["./blog"]).toBe("./blog/index.ts");
	});

	it("handles multiple features", async () => {
		const manifests = [
			makeManifest("blog", {
				server: {
					module: "BlogModule",
					router: "blogRouter",
					routerKey: "blog",
				},
			}),
			makeManifest("comment", {
				server: {
					module: "CommentModule",
					router: "commentRouter",
					routerKey: "comment",
				},
				widget: { component: "CommentSection" },
			}),
		];
		await updateFeatureExports(TEST_DIR, ["blog", "comment"], manifests);
		const featuresPkg = JSON.parse(
			readFileSync(join(TEST_DIR, "packages/features/package.json"), "utf-8"),
		);
		expect(featuresPkg.exports["./blog"]).toBeDefined();
		expect(featuresPkg.exports["./comment"]).toBeDefined();
		const widgetsPkg = JSON.parse(
			readFileSync(join(TEST_DIR, "packages/widgets/package.json"), "utf-8"),
		);
		expect(widgetsPkg.exports["./comment"]).toBeDefined();
	});
});
