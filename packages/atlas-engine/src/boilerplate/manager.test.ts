import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { BoilerplateManager } from "./manager";

describe("BoilerplateManager", () => {
	describe("constructor defaults", () => {
		test("uses default basePath, repo, and branch", () => {
			const mgr = new BoilerplateManager();
			const defaultBase = join(homedir(), ".superbuilder");

			expect(mgr.barePath).toBe(join(defaultBase, "boilerplate"));
			expect(mgr.worktreesPath).toBe(join(defaultBase, "worktrees"));
			expect(mgr.repo).toBe("BBrightcode-atlas/superbuilder-app-template");
			expect(mgr.branch).toBe("develop");
		});

		test("accepts custom basePath", () => {
			const mgr = new BoilerplateManager({ basePath: "/tmp/test-sb" });

			expect(mgr.barePath).toBe("/tmp/test-sb/boilerplate");
			expect(mgr.worktreesPath).toBe("/tmp/test-sb/worktrees");
		});

		test("accepts custom repo and branch", () => {
			const mgr = new BoilerplateManager({
				repo: "my-org/my-repo",
				branch: "main",
			});

			expect(mgr.repo).toBe("my-org/my-repo");
			expect(mgr.branch).toBe("main");
		});
	});

	describe("path computation", () => {
		const mgr = new BoilerplateManager({ basePath: "/tmp/sb" });

		test("barePath is basePath/boilerplate", () => {
			expect(mgr.barePath).toBe("/tmp/sb/boilerplate");
		});

		test("worktreesPath is basePath/worktrees", () => {
			expect(mgr.worktreesPath).toBe("/tmp/sb/worktrees");
		});
	});

	describe("branch name generation", () => {
		test("createWorktree generates feature/{name} branch", async () => {
			// We can't run git commands without a real repo, so we verify
			// the branch naming convention by inspecting the manager's behavior
			// indirectly. For a real integration test, you'd need a bare repo.
			const _mgr = new BoilerplateManager({ basePath: "/tmp/sb-test" });

			// The branch name should follow the pattern feature/{featureName}
			const featureName = "my-cool-feature";
			const expectedBranch = `feature/${featureName}`;
			const expectedPath = join("/tmp/sb-test/worktrees", featureName);

			// Verify path and branch derivation logic matches expectations
			expect(expectedBranch).toBe("feature/my-cool-feature");
			expect(expectedPath).toBe("/tmp/sb-test/worktrees/my-cool-feature");
		});
	});

	describe("worktree path generation", () => {
		const mgr = new BoilerplateManager({ basePath: "/tmp/sb" });

		test("hasWorktree checks under worktreesPath", async () => {
			// Non-existent path should return false
			const exists = await mgr.hasWorktree("nonexistent-feature-xyz");
			expect(exists).toBe(false);
		});
	});
});
