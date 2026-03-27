import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FeatureManifest } from "../manifest/types";
import { applyConnections } from "./apply-connections";

const TEST_DIR = join(import.meta.dir, "__test_fixtures_apply__");

function makeManifest(
	overrides: Partial<FeatureManifest> = {},
): FeatureManifest {
	return {
		id: "blog",
		name: "Blog",
		version: "1.0.0",
		type: "page",
		group: "content",
		icon: "pencil",
		dependencies: [],
		provides: {},
		...overrides,
	};
}

function setupTemplateFiles() {
	// apps/server/src/app.module.ts
	const appModuleDir = join(TEST_DIR, "apps", "server", "src");
	mkdirSync(appModuleDir, { recursive: true });
	writeFileSync(
		join(appModuleDir, "app.module.ts"),
		[
			"// [ATLAS:IMPORTS]",
			"// [/ATLAS:IMPORTS]",
			"@Module({",
			"  imports: [",
			"    // [ATLAS:MODULES]",
			"    // [/ATLAS:MODULES]",
			"  ],",
			"})",
		].join("\n"),
	);

	// apps/server/src/trpc/router.ts
	const trpcDir = join(TEST_DIR, "apps", "server", "src", "trpc");
	mkdirSync(trpcDir, { recursive: true });
	writeFileSync(
		join(trpcDir, "router.ts"),
		[
			"// [ATLAS:IMPORTS]",
			"// [/ATLAS:IMPORTS]",
			"const appRouter = router({",
			"  // [ATLAS:ROUTERS]",
			"  // [/ATLAS:ROUTERS]",
			"});",
		].join("\n"),
	);

	// packages/features/app-router.ts
	const featuresDir = join(TEST_DIR, "packages", "features");
	mkdirSync(featuresDir, { recursive: true });
	writeFileSync(
		join(featuresDir, "app-router.ts"),
		[
			"// [ATLAS:IMPORTS]",
			"// [/ATLAS:IMPORTS]",
			"export const routes = [",
			"  // [ATLAS:ROUTERS]",
			"  // [/ATLAS:ROUTERS]",
			"];",
		].join("\n"),
	);

	// apps/app/src/router.tsx
	const appDir = join(TEST_DIR, "apps", "app", "src");
	mkdirSync(appDir, { recursive: true });
	writeFileSync(
		join(appDir, "router.tsx"),
		[
			"// [ATLAS:IMPORTS]",
			"// [/ATLAS:IMPORTS]",
			"const routes = [",
			"  // [ATLAS:ROUTES]",
			"  // [/ATLAS:ROUTES]",
			"];",
		].join("\n"),
	);

	// apps/system-admin/src/router.tsx
	const adminDir = join(TEST_DIR, "apps", "system-admin", "src");
	mkdirSync(adminDir, { recursive: true });
	writeFileSync(
		join(adminDir, "router.tsx"),
		[
			"// [ATLAS:IMPORTS]",
			"// [/ATLAS:IMPORTS]",
			"const adminRoutes = [",
			"  // [ATLAS:ADMIN_ROUTES]",
			"  // [/ATLAS:ADMIN_ROUTES]",
			"];",
		].join("\n"),
	);

	// packages/drizzle/src/schema/index.ts
	const schemaDir = join(TEST_DIR, "packages", "drizzle", "src", "schema");
	mkdirSync(schemaDir, { recursive: true });
	writeFileSync(
		join(schemaDir, "index.ts"),
		["// [ATLAS:SCHEMAS]", "// [/ATLAS:SCHEMAS]"].join("\n"),
	);

	// packages/widgets/package.json
	const widgetsDir = join(TEST_DIR, "packages", "widgets");
	mkdirSync(widgetsDir, { recursive: true });
	writeFileSync(
		join(widgetsDir, "package.json"),
		JSON.stringify({
			name: "@repo/widgets",
			exports: { ".": "./src/index.ts" },
		}),
	);
}

describe("applyConnections", () => {
	beforeEach(() => {
		mkdirSync(TEST_DIR, { recursive: true });
		setupTemplateFiles();
	});

	afterEach(() => {
		rmSync(TEST_DIR, { recursive: true, force: true });
	});

	it("inserts NestJS module import and ref at markers", () => {
		const manifest = makeManifest({
			provides: {
				server: {
					module: "BlogModule",
					router: "blogRouter",
					routerKey: "blog",
				},
			},
		});

		applyConnections(TEST_DIR, manifest);

		const appModule = readFileSync(
			join(TEST_DIR, "apps", "server", "src", "app.module.ts"),
			"utf-8",
		);
		expect(appModule).toContain(
			'import { BlogModule } from "@repo/features/blog"',
		);
		expect(appModule).toContain("BlogModule,");
	});

	it("inserts tRPC router at both runtime and type files", () => {
		const manifest = makeManifest({
			provides: {
				server: {
					module: "BlogModule",
					router: "blogRouter",
					routerKey: "blog",
				},
			},
		});

		applyConnections(TEST_DIR, manifest);

		const trpcRouter = readFileSync(
			join(TEST_DIR, "apps", "server", "src", "trpc", "router.ts"),
			"utf-8",
		);
		expect(trpcRouter).toContain(
			'import { blogRouter } from "@repo/features/blog"',
		);
		expect(trpcRouter).toContain("blog: blogRouter,");

		const appRouter = readFileSync(
			join(TEST_DIR, "packages", "features", "app-router.ts"),
			"utf-8",
		);
		expect(appRouter).toContain('import { blogRouter } from "./blog"');
		expect(appRouter).toContain("blog: blogRouter,");
	});

	it("inserts client routes at app router markers", () => {
		const manifest = makeManifest({
			provides: {
				client: { routes: "createBlogRoutes" },
			},
		});

		applyConnections(TEST_DIR, manifest);

		const router = readFileSync(
			join(TEST_DIR, "apps", "app", "src", "router.tsx"),
			"utf-8",
		);
		expect(router).toContain(
			'import { createBlogRoutes } from "@/features/blog"',
		);
		expect(router).toContain("...createBlogRoutes(appLayoutRoute),");
	});

	it("inserts admin routes at admin router markers", () => {
		const manifest = makeManifest({
			provides: {
				admin: {
					routes: "createBlogAdminRoutes",
					menu: { label: "Blog", icon: "pencil", order: 10 },
				},
			},
		});

		applyConnections(TEST_DIR, manifest);

		const adminRouter = readFileSync(
			join(TEST_DIR, "apps", "system-admin", "src", "router.tsx"),
			"utf-8",
		);
		expect(adminRouter).toContain(
			'import { createBlogAdminRoutes } from "./features/blog"',
		);
		expect(adminRouter).toContain(
			"...createBlogAdminRoutes(adminLayoutRoute),",
		);
	});

	it("handles widget feature with widget export", () => {
		const manifest = makeManifest({
			id: "comment",
			type: "widget",
			provides: {
				server: {
					module: "CommentModule",
					router: "commentRouter",
					routerKey: "comment",
				},
				widget: { component: "CommentSection", props: ["targetId"] },
			},
		});

		applyConnections(TEST_DIR, manifest);

		const widgetPkg = JSON.parse(
			readFileSync(
				join(TEST_DIR, "packages", "widgets", "package.json"),
				"utf-8",
			),
		);
		expect(widgetPkg.exports["./comment"]).toBe("./src/comment/index.ts");
		expect(widgetPkg.exports["."]).toBe("./src/index.ts");
	});

	it("handles manifest with no provides gracefully", () => {
		const manifest = makeManifest({ provides: {} });
		applyConnections(TEST_DIR, manifest);

		const appModule = readFileSync(
			join(TEST_DIR, "apps", "server", "src", "app.module.ts"),
			"utf-8",
		);
		expect(appModule).not.toContain("import {");
	});

	it("applies multiple features to same template files", () => {
		const blog = makeManifest({
			id: "blog",
			provides: {
				server: {
					module: "BlogModule",
					router: "blogRouter",
					routerKey: "blog",
				},
			},
		});
		const auth = makeManifest({
			id: "auth",
			provides: {
				server: {
					module: "AuthModule",
					router: "authRouter",
					routerKey: "auth",
				},
			},
		});

		applyConnections(TEST_DIR, blog);
		applyConnections(TEST_DIR, auth);

		const appModule = readFileSync(
			join(TEST_DIR, "apps", "server", "src", "app.module.ts"),
			"utf-8",
		);
		expect(appModule).toContain("BlogModule,");
		expect(appModule).toContain("AuthModule,");
	});

	it("inserts schema exports", () => {
		const manifest = makeManifest({
			provides: {
				schema: { tables: ["posts", "post_tags"] },
			},
		});

		applyConnections(TEST_DIR, manifest);

		const schemaIndex = readFileSync(
			join(TEST_DIR, "packages", "drizzle", "src", "schema", "index.ts"),
			"utf-8",
		);
		expect(schemaIndex).toContain('export * from "./features/blog"');
	});
});
