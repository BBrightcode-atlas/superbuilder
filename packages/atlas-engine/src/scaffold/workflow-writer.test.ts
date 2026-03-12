import { describe, expect, test } from "bun:test";
import { generateWorkflowMarkdown } from "./workflow-writer";
import type { FeatureRegistry } from "../registry/types";

describe("generateWorkflowMarkdown", () => {
	const registry: FeatureRegistry = {
		version: "1.0.0",
		source: "test",
		core: ["auth"],
		groups: {},
		features: {
			auth: {
				name: "auth",
				type: "page",
				icon: "Shield",
				group: "core",
				dependencies: [],
				optionalDependencies: [],
				router: {
					key: "auth",
					import: "authRouter",
					from: "@repo/features/auth",
				},
				server: {
					module: "packages/features/auth",
					router: "",
					controller: "",
				},
				client: { app: "apps/app/src/features/auth" },
				schema: { tables: ["profiles"], path: "" },
			},
			blog: {
				name: "blog",
				type: "page",
				icon: "FileText",
				group: "content",
				dependencies: ["auth"],
				optionalDependencies: [],
				router: {
					key: "blog",
					import: "blogRouter",
					from: "@repo/features/blog",
				},
				server: {
					module: "packages/features/blog",
					router: "",
					controller: "",
				},
				client: { app: "apps/app/src/features/blog" },
				schema: { tables: ["blog_posts", "blog_categories"], path: "" },
			},
		},
	};

	test("generates markdown with feature list in order", () => {
		const md = generateWorkflowMarkdown({
			resolvedFeatureNames: ["auth", "blog"],
			featureRegistry: registry,
			sourceRepo: "/home/user/superbuilder",
		});

		expect(md).toContain("auth");
		expect(md).toContain("blog");
		expect(md).toContain("/home/user/superbuilder");
		expect(md).toContain("[ATLAS:");
		expect(md).toContain("Import 경로 변환");
		expect(md).toContain("bun install");
	});

	test("includes feature-specific module and router names", () => {
		const md = generateWorkflowMarkdown({
			resolvedFeatureNames: ["blog"],
			featureRegistry: registry,
			sourceRepo: "/tmp/sb",
		});

		expect(md).toContain("blogRouter");
		expect(md).toContain("blog_posts");
		expect(md).toContain("blog_categories");
	});

	test("includes dependency info for features with deps", () => {
		const md = generateWorkflowMarkdown({
			resolvedFeatureNames: ["auth", "blog"],
			featureRegistry: registry,
			sourceRepo: "/tmp/sb",
		});

		expect(md).toContain("depends: auth");
	});

	test("includes import alias mapping table", () => {
		const md = generateWorkflowMarkdown({
			resolvedFeatureNames: ["auth"],
			featureRegistry: registry,
			sourceRepo: "/tmp/sb",
		});

		expect(md).toContain("@superbuilder/features-server");
		expect(md).toContain("@repo/features");
	});
});
