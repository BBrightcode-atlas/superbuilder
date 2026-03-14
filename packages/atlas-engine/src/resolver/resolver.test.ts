import { describe, expect, test } from "bun:test";
import type { BoilerplateManifest } from "../manifest/types";
import { resolveFeatures } from "./resolver";

function createManifest(): BoilerplateManifest {
	return {
		version: "1.0.0",
		source: {
			repo: "test",
			branch: "main",
			lastSyncedCommit: "abc",
			syncedAt: "",
		},
		features: {
			profile: {
				name: "profile",
				type: "page",
				group: "core",
				dependencies: [],
				optionalDependencies: [],
				dependents: ["blog", "comment", "payment"],
				paths: { server: "packages/features/profile" },
				connections: [],
				tables: [],
				router: { key: "profile", importName: "profileRouter" },
			},
			blog: {
				name: "blog",
				type: "page",
				group: "content",
				dependencies: ["profile"],
				optionalDependencies: ["comment", "reaction"],
				dependents: [],
				paths: { server: "packages/features/blog" },
				connections: [],
				tables: [],
				router: { key: "blog", importName: "blogRouter" },
			},
			comment: {
				name: "comment",
				type: "widget",
				group: "community",
				dependencies: ["profile"],
				optionalDependencies: [],
				dependents: [],
				paths: { server: "packages/features/comment" },
				connections: [],
				tables: [],
				router: { key: "comment", importName: "commentRouter" },
			},
			reaction: {
				name: "reaction",
				type: "widget",
				group: "community",
				dependencies: ["profile"],
				optionalDependencies: [],
				dependents: [],
				paths: { server: "packages/features/reaction" },
				connections: [],
				tables: [],
				router: { key: "reaction", importName: "reactionRouter" },
			},
			payment: {
				name: "payment",
				type: "page",
				group: "commerce",
				dependencies: ["profile"],
				optionalDependencies: [],
				dependents: [],
				paths: { server: "packages/features/payment" },
				connections: [],
				tables: [],
				router: { key: "payment", importName: "paymentRouter" },
			},
		},
	};
}

describe("resolveFeatures", () => {
	const manifest = createManifest();

	test("should auto-include core features", () => {
		const result = resolveFeatures(manifest, ["blog"]);
		expect(result.resolved).toContain("profile");
		expect(result.autoIncluded).toContain("profile");
	});

	test("should include direct dependencies", () => {
		const result = resolveFeatures(manifest, ["blog"]);
		expect(result.resolved).toContain("profile");
		expect(result.resolved).toContain("blog");
	});

	test("should list available optional dependencies", () => {
		const result = resolveFeatures(manifest, ["blog"]);
		expect(result.availableOptional).toContain("comment");
		expect(result.availableOptional).toContain("reaction");
	});

	test("should return topologically sorted order", () => {
		const result = resolveFeatures(manifest, ["blog", "comment"]);
		const profileIdx = result.resolved.indexOf("profile");
		const blogIdx = result.resolved.indexOf("blog");
		expect(profileIdx).toBeLessThan(blogIdx);
	});

	test("should handle empty selection (core only)", () => {
		const result = resolveFeatures(manifest, []);
		expect(result.resolved).toEqual(["profile"]);
	});

	test("should detect missing dependency", () => {
		const bad = structuredClone(manifest);
		bad.features.blog.dependencies = ["nonexistent"];
		expect(() => resolveFeatures(bad, ["blog"])).toThrow("missing_dependency");
	});

	test("should detect circular dependency", () => {
		const bad = structuredClone(manifest);
		bad.features.profile.dependencies = ["blog"];
		expect(() => resolveFeatures(bad, ["blog"])).toThrow("circular_dependency");
	});
});
