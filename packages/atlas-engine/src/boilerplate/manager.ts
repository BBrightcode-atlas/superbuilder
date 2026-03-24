import { execFile as execFileCb } from "node:child_process";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

const DEFAULT_REPO = "BBrightcode-atlas/feature-atlas-template";
const DEFAULT_BRANCH = "develop";
const DEFAULT_BASE_PATH = join(homedir(), ".superbuilder");

export interface BoilerplateManagerConfig {
	basePath?: string;
	repo?: string;
	branch?: string;
}

export interface WorktreeInfo {
	featureName: string;
	path: string;
	branch: string;
}

export class BoilerplateManager {
	readonly barePath: string;
	readonly worktreesPath: string;
	readonly repo: string;
	readonly branch: string;

	constructor(config?: BoilerplateManagerConfig) {
		const basePath = config?.basePath ?? DEFAULT_BASE_PATH;
		this.barePath = join(basePath, "boilerplate");
		this.worktreesPath = join(basePath, "worktrees");
		this.repo = config?.repo ?? DEFAULT_REPO;
		this.branch = config?.branch ?? DEFAULT_BRANCH;
	}

	/**
	 * Bare clone the boilerplate repo (idempotent).
	 * If the bare repo already exists, this is a no-op.
	 */
	async init(): Promise<void> {
		const gitDir = join(this.barePath, ".git");
		try {
			const s = await stat(gitDir);
			if (s.isFile() || s.isDirectory()) {
				return; // Already initialised
			}
		} catch {
			// Does not exist — proceed with clone
		}

		// For a bare clone, .git doesn't exist as a subdirectory — the barePath
		// *is* the git dir. Check for HEAD as a more reliable indicator.
		try {
			const head = join(this.barePath, "HEAD");
			const s = await stat(head);
			if (s.isFile()) {
				return; // Already initialised (bare repo)
			}
		} catch {
			// Does not exist — proceed with clone
		}

		await execFile("gh", [
			"repo",
			"clone",
			this.repo,
			this.barePath,
			"--",
			"--bare",
		]);
	}

	/**
	 * Fetch the latest changes from the remote.
	 */
	async pull(): Promise<void> {
		await execFile("git", ["fetch", "origin", this.branch], {
			cwd: this.barePath,
		});
	}

	/**
	 * Create a new worktree for a feature branch.
	 */
	async createWorktree(featureName: string): Promise<WorktreeInfo> {
		const worktreePath = join(this.worktreesPath, featureName);
		const branchName = `feature/${featureName}`;

		// Delete existing branch if any (ignore errors)
		try {
			await execFile("git", ["branch", "-D", branchName], {
				cwd: this.barePath,
			});
		} catch {
			// Branch may not exist — that's fine
		}

		// Create worktree with a new branch based on origin/{branch}
		await execFile(
			"git",
			[
				"worktree",
				"add",
				worktreePath,
				"-b",
				branchName,
				`origin/${this.branch}`,
			],
			{ cwd: this.barePath },
		);

		return {
			featureName,
			path: worktreePath,
			branch: branchName,
		};
	}

	/**
	 * Remove a worktree and its feature branch.
	 * Idempotent — ignores errors if already removed.
	 */
	async removeWorktree(featureName: string): Promise<void> {
		const worktreePath = join(this.worktreesPath, featureName);

		try {
			await execFile("git", ["worktree", "remove", worktreePath, "--force"], {
				cwd: this.barePath,
			});
		} catch {
			// May already be removed
		}

		try {
			await execFile("git", ["branch", "-D", `feature/${featureName}`], {
				cwd: this.barePath,
			});
		} catch {
			// Branch may already be deleted
		}
	}

	/**
	 * Check whether a worktree for the given feature exists on disk.
	 */
	async hasWorktree(featureName: string): Promise<boolean> {
		try {
			const s = await stat(join(this.worktreesPath, featureName));
			return s.isDirectory();
		} catch {
			return false;
		}
	}

	/**
	 * List all feature worktrees that live under the worktreesPath.
	 */
	async listWorktrees(): Promise<WorktreeInfo[]> {
		let stdout: string;
		try {
			const result = await execFile(
				"git",
				["worktree", "list", "--porcelain"],
				{ cwd: this.barePath },
			);
			stdout = result.stdout;
		} catch {
			return [];
		}

		const entries: WorktreeInfo[] = [];
		const blocks = stdout.split("\n\n").filter(Boolean);

		for (const block of blocks) {
			const lines = block.split("\n");
			let worktreePath = "";
			let branch = "";

			for (const line of lines) {
				if (line.startsWith("worktree ")) {
					worktreePath = line.slice("worktree ".length);
				}
				if (line.startsWith("branch ")) {
					branch = line.slice("branch ".length).replace("refs/heads/", "");
				}
			}

			// Only include worktrees that live under our worktreesPath
			if (worktreePath?.startsWith(this.worktreesPath)) {
				const featureName = worktreePath.slice(this.worktreesPath.length + 1); // +1 for trailing slash
				entries.push({ featureName, path: worktreePath, branch });
			}
		}

		return entries;
	}

	/**
	 * Create a GitHub PR from a feature worktree.
	 * Returns the PR URL.
	 */
	async createPR(
		featureName: string,
		title: string,
		body: string,
	): Promise<string> {
		const worktreePath = join(this.worktreesPath, featureName);

		const { stdout } = await execFile(
			"gh",
			["pr", "create", "--repo", this.repo, "--title", title, "--body", body],
			{ cwd: worktreePath },
		);

		return stdout.trim();
	}
}
