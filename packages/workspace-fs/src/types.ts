export interface WorkspaceFsEntry {
	id: string;
	name: string;
	absolutePath: string;
	relativePath: string;
	isDirectory: boolean;
}

export interface WorkspaceFsSearchResult extends WorkspaceFsEntry {
	score: number;
}

export interface WorkspaceFsKeywordMatch extends WorkspaceFsEntry {
	line: number;
	column: number;
	preview: string;
}

export type WorkspaceFsWatchEvent =
	| {
			type: "create" | "update" | "delete";
			workspaceId: string;
			absolutePath: string;
			isDirectory: boolean;
			revision: number;
	  }
	| {
			type: "overflow";
			workspaceId: string;
			revision: number;
	  };
