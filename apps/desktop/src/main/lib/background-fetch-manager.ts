import { projects } from "@superset/local-db";
import { eq, isNotNull } from "drizzle-orm";
import {
	hasOriginRemote,
	refreshDefaultBranch,
} from "lib/trpc/routers/workspaces/utils/git";
import simpleGit from "simple-git";
import { localDb } from "./local-db";
import { workspaceInitManager } from "./workspace-init-manager";

const FETCH_INTERVAL_MS = 60_000;
const DEFAULT_THRESHOLD_MS = 90_000;

class BackgroundFetchManager {
	private lastFetchedAt = new Map<string, number>();
	private lastDefaultBranch = new Map<string, string>();
	private fetchInProgress = new Set<string>();
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private started = false;

	start(): void {
		if (this.started) return;
		this.started = true;

		void this.runFetchCycle();

		this.intervalId = setInterval(() => {
			void this.runFetchCycle();
		}, FETCH_INTERVAL_MS);
		this.intervalId.unref();
	}

	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		this.started = false;
	}

	isFetchRecent(
		projectId: string,
		thresholdMs = DEFAULT_THRESHOLD_MS,
	): boolean {
		const lastFetch = this.lastFetchedAt.get(projectId);
		if (!lastFetch) return false;
		return Date.now() - lastFetch < thresholdMs;
	}

	getLastDefaultBranch(projectId: string): string | null {
		return this.lastDefaultBranch.get(projectId) ?? null;
	}

	private async runFetchCycle(): Promise<void> {
		const activeProjects = localDb
			.select({
				id: projects.id,
				mainRepoPath: projects.mainRepoPath,
				defaultBranch: projects.defaultBranch,
			})
			.from(projects)
			.where(isNotNull(projects.tabOrder))
			.all();

		if (activeProjects.length === 0) return;

		await Promise.allSettled(
			activeProjects.map((project) => this.fetchProject(project)),
		);
	}

	private async fetchProject(project: {
		id: string;
		mainRepoPath: string;
		defaultBranch: string | null;
	}): Promise<void> {
		const { id: projectId, mainRepoPath } = project;

		if (this.fetchInProgress.has(projectId)) return;

		// Avoid git lock contention with workspace init
		if (workspaceInitManager.hasProjectLock(projectId)) return;

		if (!(await hasOriginRemote(mainRepoPath))) return;

		this.fetchInProgress.add(projectId);
		try {
			const git = simpleGit(mainRepoPath);
			await git.fetch(["--prune", "origin"]);
			this.lastFetchedAt.set(projectId, Date.now());

			try {
				const remoteBranch = await refreshDefaultBranch(mainRepoPath);
				if (remoteBranch) {
					this.lastDefaultBranch.set(projectId, remoteBranch);
					if (remoteBranch !== project.defaultBranch) {
						localDb
							.update(projects)
							.set({ defaultBranch: remoteBranch })
							.where(eq(projects.id, projectId))
							.run();
					}
				}
			} catch {
				// Non-critical — next cycle will retry
			}
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			// Git lock contention is transient — next cycle will succeed
			if (!message.includes(".lock")) {
				console.warn(
					`[background-fetch] Fetch failed for ${projectId}:`,
					message,
				);
			}
		} finally {
			this.fetchInProgress.delete(projectId);
		}
	}
}

export const backgroundFetchManager = new BackgroundFetchManager();

export function initBackgroundFetch(): void {
	backgroundFetchManager.start();
}
