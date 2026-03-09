import type {
	WorkspaceFsEntry,
	WorkspaceFsKeywordMatch,
	WorkspaceFsSearchResult,
	WorkspaceFsWatchEvent,
} from "../types";

export interface WorkspaceFsLocation {
	workspaceId: string;
	absolutePath: string;
}

export interface WorkspaceFsDirectoryQuery extends WorkspaceFsLocation {}

export interface WorkspaceFsWriteFileInput extends WorkspaceFsLocation {
	content: string;
	expectedContent?: string;
}

export interface WorkspaceFsSearchFilesInput {
	workspaceId: string;
	query: string;
	includeHidden?: boolean;
	includePattern?: string;
	excludePattern?: string;
	limit?: number;
}

export interface WorkspaceFsWatchInput {
	workspaceId: string;
}

export interface WorkspaceFsQueryService {
	listDirectory(input: WorkspaceFsDirectoryQuery): Promise<WorkspaceFsEntry[]>;
	readTextFile(input: WorkspaceFsLocation): Promise<string>;
	readFileBuffer(input: WorkspaceFsLocation): Promise<Buffer>;
	statFile(input: WorkspaceFsLocation): Promise<unknown>;
	pathExists(input: WorkspaceFsLocation): Promise<boolean>;
}

export interface WorkspaceFsMutationService {
	writeTextFile(input: WorkspaceFsWriteFileInput): Promise<void>;
}

export interface WorkspaceFsSearchService {
	searchFiles(
		input: WorkspaceFsSearchFilesInput,
	): Promise<WorkspaceFsSearchResult[]>;
	searchKeyword(
		input: WorkspaceFsSearchFilesInput,
	): Promise<WorkspaceFsKeywordMatch[]>;
}

export interface WorkspaceFsWatchService {
	watchWorkspace(
		input: WorkspaceFsWatchInput,
	): AsyncIterable<WorkspaceFsWatchEvent>;
}
