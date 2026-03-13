import { describe, test, expect } from "bun:test";
import { resolveFeatures } from "../resolver";
import { buildProjectSpec } from "./spec-writer";
import { generateWorkflowMarkdown } from "./workflow-writer";
import { DEFAULT_PATH_MAPPING, IMPORT_ALIAS_MAP } from "./path-mapping";
import type { FeatureRegistry } from "../registry/types";

describe("scaffold integration", () => {
	// Use a minimal registry matching the real FeatureRegistry interface
	const registry: FeatureRegistry = {
		version: "1.0.0",
		source: "test",
		core: ["auth"],
		groups: {
			core: { label: "Core", order: 0 },
			content: { label: "Content", order: 1 },
		},
		features: {
			auth: {
				name: "auth",
				type: "page",
				icon: "Shield",
				group: "core",
				description: "인증",
				dependencies: [],
				optionalDependencies: [],
				router: {
					key: "auth",
					import: "authRouter",
					from: "@superbuilder/features-server/auth",
				},
				server: {
					module: "packages/features-server/features/auth/auth.module.ts",
					router: "packages/features-server/features/auth/trpc/auth.router.ts",
					controller: "packages/features-server/features/auth/controller/auth.controller.ts",
				},
				client: {
					app: "apps/features-app/src/features/auth",
				},
				schema: {
					path: "packages/drizzle/src/schema/features/auth",
					tables: ["auth_users", "auth_sessions"],
				},
			},
			blog: {
				name: "blog",
				type: "page",
				icon: "FileText",
				group: "content",
				description: "블로그",
				dependencies: ["auth"],
				optionalDependencies: [],
				router: {
					key: "blog",
					import: "blogRouter",
					from: "@superbuilder/features-server/blog",
				},
				server: {
					module: "packages/features-server/features/blog/blog.module.ts",
					router: "packages/features-server/features/blog/trpc/blog.router.ts",
					controller: "packages/features-server/features/blog/controller/blog.controller.ts",
				},
				client: {
					app: "apps/features-app/src/features/blog",
				},
				schema: {
					path: "packages/drizzle/src/schema/features/blog",
					tables: ["blog_posts", "blog_categories"],
				},
			},
		},
	};

	test("full pipeline: resolve → spec → workflow", () => {
		// 1. Resolve features
		const resolved = resolveFeatures(registry, ["blog"]);
		expect(resolved.resolved).toContain("auth");
		expect(resolved.resolved).toContain("blog");
		expect(resolved.autoIncluded).toContain("auth");

		// 2. Build project spec
		const spec = buildProjectSpec({
			name: "test-project",
			description: "Integration test",
			config: {
				database: { provider: "neon" },
				auth: { provider: "better-auth", features: ["email"] },
				deploy: { provider: "vercel" },
			},
			resolved,
			pathMapping: DEFAULT_PATH_MAPPING,
		});

		expect(spec.name).toBe("test-project");
		expect(spec.description).toBe("Integration test");
		expect(spec.config.database.provider).toBe("neon");
		expect(spec.config.auth.provider).toBe("better-auth");
		expect(spec.features.selected).toEqual(["blog"]);
		expect(spec.features.resolved).toContain("auth");
		expect(spec.features.resolved).toContain("blog");
		expect(spec.features.autoIncluded).toContain("auth");
		expect(spec.source.type).toBe("superbuilder");
		expect(spec.pathMapping).toEqual(DEFAULT_PATH_MAPPING);
		expect(spec.installed).toEqual({});

		// 3. Generate workflow
		const workflow = generateWorkflowMarkdown({
			resolvedFeatureNames: resolved.resolved,
			featureRegistry: registry,
			sourceRepo: "/Users/bright/Projects/superbuilder",
		});

		expect(workflow).toContain("## Feature");
		expect(workflow).toContain("auth");
		expect(workflow).toContain("blog");
		expect(workflow.length).toBeGreaterThan(500);

		// 4. Verify import alias mapping completeness
		for (const [from, to] of Object.entries(IMPORT_ALIAS_MAP)) {
			expect(workflow).toContain(from);
			expect(workflow).toContain(to);
		}

		// 5. Verify topology order (auth before blog since blog depends on auth)
		const authIdx = workflow.indexOf("### auth");
		const blogIdx = workflow.indexOf("### blog");
		expect(authIdx).toBeLessThan(blogIdx);
	});

	test("spec has correct version and source metadata", () => {
		const resolved = resolveFeatures(registry, ["auth"]);
		const spec = buildProjectSpec({
			name: "my-app",
			config: {
				database: { provider: "neon" },
				auth: { provider: "better-auth", features: ["email"] },
				deploy: { provider: "none" },
			},
			resolved,
			pathMapping: DEFAULT_PATH_MAPPING,
		});

		expect(spec.version).toBe("0.1.0");
		expect(spec.source.templateRepo).toBe("BBrightcode-atlas/feature-atlas-template");
		expect(spec.source.repo).toBe("BBrightcode-atlas/superbuilder");
		expect(spec.source.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});
});
