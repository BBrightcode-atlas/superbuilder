import { describe, expect, it } from "bun:test";
import type { Provides } from "../manifest/types";
import { deriveConnections } from "./deriver";

describe("deriveConnections", () => {
	it("returns empty object when provides is empty", () => {
		const result = deriveConnections("blog", {});
		expect(result).toEqual({});
	});

	it("derives NestJS module connections from server provides", () => {
		const provides: Provides = {
			server: { module: "BlogModule", router: "blogRouter", routerKey: "blog" },
		};
		const result = deriveConnections("blog", provides);
		expect(result.nestModuleImport).toBe(
			'import { BlogModule } from "@repo/features/blog";',
		);
		expect(result.nestModuleRef).toBe("BlogModule,");
	});

	it("derives tRPC router connections from server provides", () => {
		const provides: Provides = {
			server: { module: "BlogModule", router: "blogRouter", routerKey: "blog" },
		};
		const result = deriveConnections("blog", provides);
		expect(result.trpcRouterImport).toBe(
			'import { blogRouter } from "@repo/features/blog";',
		);
		expect(result.trpcRouterKey).toBe("blog: blogRouter,");
		expect(result.trpcTypeImport).toBe('import { blogRouter } from "./blog";');
		expect(result.trpcTypeKey).toBe("blog: blogRouter,");
	});

	it("derives client route connections from client provides", () => {
		const provides: Provides = {
			client: { routes: "createBlogRoutes" },
		};
		const result = deriveConnections("blog", provides);
		expect(result.clientRoutesImport).toBe(
			'import { createBlogRoutes } from "@/features/blog";',
		);
		expect(result.clientRoutesSpread).toBe(
			"...createBlogRoutes(appLayoutRoute),",
		);
	});

	it("derives admin connections from admin provides", () => {
		const provides: Provides = {
			admin: {
				routes: "createBlogAdminRoutes",
				menu: { label: "Blog", icon: "pencil", order: 10 },
			},
		};
		const result = deriveConnections("blog", provides);
		expect(result.adminRoutesImport).toBe(
			'import { createBlogAdminRoutes } from "./features/blog";',
		);
		expect(result.adminRoutesSpread).toBe(
			"...createBlogAdminRoutes(adminLayoutRoute),",
		);
		expect(result.adminMenu).toBe(
			JSON.stringify({
				id: "blog",
				label: "Blog",
				icon: "pencil",
				order: 10,
				path: "/blog",
			}),
		);
	});

	it("derives schema connections from schema provides", () => {
		const provides: Provides = {
			schema: { tables: ["posts", "post_tags"] },
		};
		const result = deriveConnections("blog", provides);
		expect(result.schemaExport).toBe('export * from "./features/blog";');
		expect(result.tablesFilter).toBe('"posts", "post_tags"');
	});

	it("derives widget export from widget provides", () => {
		const provides: Provides = {
			widget: { component: "CommentSection", props: ["targetId"] },
		};
		const result = deriveConnections("comment", provides);
		expect(result.widgetExport).toEqual({
			subpath: "./comment",
			entry: "./src/comment/index.ts",
		});
	});

	it("derives admin connections without menu", () => {
		const provides: Provides = {
			admin: { routes: "createBlogAdminRoutes" },
		};
		const result = deriveConnections("blog", provides);
		expect(result.adminRoutesImport).toBeDefined();
		expect(result.adminRoutesSpread).toBeDefined();
		expect(result.adminMenu).toBeUndefined();
	});

	it("handles single table in schema", () => {
		const provides: Provides = {
			schema: { tables: ["users"] },
		};
		const result = deriveConnections("profile", provides);
		expect(result.tablesFilter).toBe('"users"');
	});

	it("handles kebab-case feature ids", () => {
		const provides: Provides = {
			server: {
				module: "RolePermissionModule",
				router: "rolePermissionRouter",
				routerKey: "rolePermission",
			},
		};
		const result = deriveConnections("role-permission", provides);
		expect(result.nestModuleImport).toContain("@repo/features/role-permission");
		expect(result.trpcRouterImport).toContain("@repo/features/role-permission");
	});

	it("handles full provides with all sections", () => {
		const provides: Provides = {
			server: { module: "BlogModule", router: "blogRouter", routerKey: "blog" },
			client: { routes: "createBlogRoutes" },
			admin: {
				routes: "createBlogAdminRoutes",
				menu: { label: "Blog", icon: "pencil", order: 10 },
			},
			schema: { tables: ["posts"] },
			widget: { component: "BlogWidget" },
		};
		const result = deriveConnections("blog", provides);

		expect(result.nestModuleImport).toBeDefined();
		expect(result.nestModuleRef).toBeDefined();
		expect(result.trpcRouterImport).toBeDefined();
		expect(result.trpcRouterKey).toBeDefined();
		expect(result.trpcTypeImport).toBeDefined();
		expect(result.trpcTypeKey).toBeDefined();
		expect(result.clientRoutesImport).toBeDefined();
		expect(result.clientRoutesSpread).toBeDefined();
		expect(result.adminRoutesImport).toBeDefined();
		expect(result.adminRoutesSpread).toBeDefined();
		expect(result.adminMenu).toBeDefined();
		expect(result.schemaExport).toBeDefined();
		expect(result.tablesFilter).toBeDefined();
		expect(result.widgetExport).toBeDefined();
	});
});
