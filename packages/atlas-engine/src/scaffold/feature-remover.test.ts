import { describe, expect, test } from "bun:test";
import type { BoilerplateManifest } from "../manifest/types";
import { generateRemovalWorkflow } from "./feature-remover";

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
				dependents: ["blog", "payment"],
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
				optionalDependencies: [],
				dependents: [],
				paths: {
					server: "packages/features/blog",
					client: "apps/app/src/features/blog",
				},
				connections: [
					{
						file: "apps/atlas-server/src/app.module.ts",
						marker: "IMPORTS",
						content: 'import { BlogModule } from "@repo/features/blog";',
					},
				],
				tables: ["posts"],
				router: { key: "blog", importName: "blogRouter" },
			},
			payment: {
				name: "payment",
				type: "page",
				group: "commerce",
				dependencies: ["profile"],
				optionalDependencies: [],
				dependents: ["course"],
				paths: { server: "packages/features/payment" },
				connections: [],
				tables: [],
				router: { key: "payment", importName: "paymentRouter" },
			},
			course: {
				name: "course",
				type: "page",
				group: "commerce",
				dependencies: ["payment"],
				optionalDependencies: [],
				dependents: [],
				paths: { server: "packages/features/course" },
				connections: [],
				tables: [],
				router: { key: "course", importName: "courseRouter" },
			},
		},
	};
}

describe("generateRemovalWorkflow", () => {
	const manifest = createManifest();

	test("should cascade to dependents", () => {
		const md = generateRemovalWorkflow(["payment"], manifest);
		expect(md).toContain("course");
		expect(md).toContain("payment");
		expect(md).toContain("자동 제거");
	});

	test("should list directories to delete", () => {
		const md = generateRemovalWorkflow(["blog"], manifest);
		expect(md).toContain("packages/features/blog");
		expect(md).toContain("apps/app/src/features/blog");
	});

	test("should list connection cleanup", () => {
		const md = generateRemovalWorkflow(["blog"], manifest);
		expect(md).toContain("[ATLAS:IMPORTS]");
		expect(md).toContain("BlogModule");
	});

	test("should not show auto-remove section when no cascade", () => {
		const md = generateRemovalWorkflow(["course"], manifest);
		expect(md).not.toContain("자동 제거");
	});
});
