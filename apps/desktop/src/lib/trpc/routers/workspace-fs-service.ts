import {
	createWorkspaceFsHostService,
	toFileSystemChangeEvent,
	WorkspaceFsWatcherManager,
	type WorkspaceFsPathError,
} from "@superset/workspace-fs/host";
import { shell } from "electron";
import type {
	DirectoryEntry,
	FileSystemChangeEvent,
} from "shared/file-tree-types";
import { assertRegisteredWorktree } from "./changes/security/path-validation";
import { getWorkspace } from "./workspaces/utils/db-helpers";
import { execWithShellEnv } from "./workspaces/utils/shell-env";
import { getWorkspacePath } from "./workspaces/utils/worktree";

const filesystemWatcherManager = new WorkspaceFsWatcherManager();
const MAX_SEARCH_RESULTS = 500;

export interface WorkspaceKeywordSearchMatch {
	id: string;
	name: string;
	relativePath: string;
	path: string;
	line: number;
	column: number;
	preview: string;
}

export interface WorkspaceFileSearchResult {
	id: string;
	name: string;
	relativePath: string;
	path: string;
	isDirectory: boolean;
	score: number;
}

export interface WorkspaceFileSearchMultiResult
	extends WorkspaceFileSearchResult {
	workspaceId: string;
	workspaceName: string;
}

export interface WorkspaceSearchRoot {
	rootPath: string;
	workspaceId: string;
	workspaceName: string;
}

export function resolveWorkspaceRootPath(workspaceId: string): string {
	const workspace = getWorkspace(workspaceId);
	if (!workspace) {
		throw new Error(`Workspace not found: ${workspaceId}`);
	}

	const rootPath = getWorkspacePath(workspace);
	if (!rootPath) {
		throw new Error(`Workspace path not found: ${workspaceId}`);
	}

	return rootPath;
}

function resolveRegisteredWorktreeRootPath(worktreePath: string): string {
	assertRegisteredWorktree(worktreePath);
	return worktreePath;
}

const sharedHostServiceOptions = {
	runRipgrep: async (args: string[], options: { cwd: string; maxBuffer: number }) => {
		const result = await execWithShellEnv("rg", args, {
			cwd: options.cwd,
			maxBuffer: options.maxBuffer,
			windowsHide: true,
		});

		return { stdout: result.stdout };
	},
};

export const workspaceFsService = createWorkspaceFsHostService({
	resolveRootPath: resolveWorkspaceRootPath,
	watcherManager: filesystemWatcherManager,
	trashItem: async (absolutePath) => {
		await shell.trashItem(absolutePath);
	},
	...sharedHostServiceOptions,
});

export const registeredWorktreeFsService = createWorkspaceFsHostService({
	resolveRootPath: resolveRegisteredWorktreeRootPath,
	...sharedHostServiceOptions,
});

export async function readWorkspaceDirectory(input: {
	workspaceId: string;
	absolutePath: string;
}): Promise<DirectoryEntry[]> {
	const entries = await workspaceFsService.listDirectory(input);
	return entries.map((entry) => ({
		id: entry.id,
		name: entry.name,
		path: entry.absolutePath,
		relativePath: entry.relativePath,
		isDirectory: entry.isDirectory,
	}));
}

export async function* watchWorkspaceFileSystemEvents(
	workspaceId: string,
): AsyncIterable<FileSystemChangeEvent> {
	const rootPath = resolveWorkspaceRootPath(workspaceId);
	for await (const event of workspaceFsService.watchWorkspace({ workspaceId })) {
		yield toFileSystemChangeEvent(event, rootPath);
	}
}

export async function searchWorkspaceFiles(input: {
	workspaceId: string;
	query: string;
	includePattern?: string;
	excludePattern?: string;
	limit?: number;
}): Promise<WorkspaceFileSearchResult[]> {
	const results = await workspaceFsService.searchFiles({
		workspaceId: input.workspaceId,
		query: input.query,
		includeHidden: true,
		includePattern: input.includePattern,
		excludePattern: input.excludePattern,
		limit: input.limit,
	});

	return results.map((result) => ({
		id: result.id,
		name: result.name,
		relativePath: result.relativePath,
		path: result.absolutePath,
		isDirectory: false,
		score: result.score,
	}));
}

export async function searchWorkspaceFilesMulti(input: {
	roots: WorkspaceSearchRoot[];
	query: string;
	includePattern?: string;
	excludePattern?: string;
	limit?: number;
}): Promise<WorkspaceFileSearchMultiResult[]> {
	if (input.roots.length === 0) {
		return [];
	}

	const seen = new Map<string, WorkspaceSearchRoot>();
	for (const root of input.roots) {
		if (!seen.has(root.rootPath)) {
			seen.set(root.rootPath, root);
		}
	}

	const uniqueRoots = [...seen.values()];
	const safeLimit = Math.max(
		1,
		Math.min(input.limit ?? 50, MAX_SEARCH_RESULTS),
	);
	const perRootLimit = Math.max(10, Math.ceil(safeLimit / uniqueRoots.length));

	const allResults = await Promise.all(
		uniqueRoots.map(async (root) => {
			const results = await searchWorkspaceFiles({
				workspaceId: root.workspaceId,
				query: input.query,
				includePattern: input.includePattern,
				excludePattern: input.excludePattern,
				limit: perRootLimit,
			});

			return results.map((result) => ({
				...result,
				id: `${root.workspaceId}:${result.id}`,
				workspaceId: root.workspaceId,
				workspaceName: root.workspaceName,
			}));
		}),
	);

	return allResults
		.flat()
		.sort((left, right) => right.score - left.score)
		.slice(0, safeLimit);
}

export async function searchWorkspaceKeyword(input: {
	workspaceId: string;
	query: string;
	includePattern?: string;
	excludePattern?: string;
	limit?: number;
}): Promise<WorkspaceKeywordSearchMatch[]> {
	const results = await workspaceFsService.searchKeyword({
		workspaceId: input.workspaceId,
		query: input.query,
		includeHidden: true,
		includePattern: input.includePattern,
		excludePattern: input.excludePattern,
		limit: input.limit,
	});

	return results.map((result) => ({
		id: result.id,
		name: result.name,
		relativePath: result.relativePath,
		path: result.absolutePath,
		line: result.line,
		column: result.column,
		preview: result.preview,
	}));
}

export { toFileSystemChangeEvent };
export type { FileSystemChangeEvent, WorkspaceFsPathError };
