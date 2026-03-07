import { useCallback, useMemo, useState } from "react";
import { useDebouncedValue } from "renderer/hooks/useDebouncedValue";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useFileSearch } from "renderer/screens/main/components/WorkspaceView/RightSidebar/FilesView/hooks/useFileSearch/useFileSearch";
import {
	type SearchScope,
	useSearchDialogStore,
} from "renderer/stores/search-dialog-state";
import { useTabsStore } from "renderer/stores/tabs/store";

const SEARCH_LIMIT = 50;

interface UseCommandPaletteParams {
	workspaceId: string;
	worktreePath: string | undefined;
}

export function useCommandPalette({
	workspaceId,
	worktreePath,
}: UseCommandPaletteParams) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const includePattern = useSearchDialogStore(
		(state) => state.byMode.quickOpen.includePattern,
	);
	const excludePattern = useSearchDialogStore(
		(state) => state.byMode.quickOpen.excludePattern,
	);
	const filtersOpen = useSearchDialogStore(
		(state) => state.byMode.quickOpen.filtersOpen,
	);
	const scope = useSearchDialogStore((state) => state.byMode.quickOpen.scope);
	const setIncludePatternByMode = useSearchDialogStore(
		(state) => state.setIncludePattern,
	);
	const setExcludePatternByMode = useSearchDialogStore(
		(state) => state.setExcludePattern,
	);
	const setFiltersOpenByMode = useSearchDialogStore(
		(state) => state.setFiltersOpen,
	);
	const setScopeByMode = useSearchDialogStore((state) => state.setScope);

	// Fetch all grouped workspaces (only when global scope is active and dialog is open)
	const { data: allGrouped } = electronTrpc.workspaces.getAllGrouped.useQuery(
		undefined,
		{
			enabled: open && scope === "global",
		},
	);

	// Build roots array for multi-workspace search
	const roots = useMemo(() => {
		if (scope !== "global" || !allGrouped) return [];
		const result: {
			rootPath: string;
			workspaceId: string;
			workspaceName: string;
		}[] = [];
		for (const group of allGrouped) {
			const addWorkspace = (ws: {
				id: string;
				worktreePath: string;
				name: string;
			}) => {
				if (ws.worktreePath) {
					result.push({
						rootPath: ws.worktreePath,
						workspaceId: ws.id,
						workspaceName: [group.project.name, ws.name]
							.filter(Boolean)
							.join(" - "),
					});
				}
			};
			for (const ws of group.workspaces) {
				addWorkspace(ws);
			}
			for (const section of group.sections) {
				for (const ws of section.workspaces) {
					addWorkspace(ws);
				}
			}
		}
		return result;
	}, [scope, allGrouped]);

	// Single-workspace search (existing behavior)
	const singleSearch = useFileSearch({
		worktreePath: open && scope === "workspace" ? worktreePath : undefined,
		searchTerm: query,
		includePattern,
		excludePattern,
		limit: SEARCH_LIMIT,
	});

	// Multi-workspace search
	const debouncedQuery = useDebouncedValue(query.trim(), 150);
	const multiSearch = electronTrpc.filesystem.searchFilesMulti.useQuery(
		{
			roots,
			query: debouncedQuery,
			includePattern,
			excludePattern,
			limit: SEARCH_LIMIT,
		},
		{
			enabled:
				open &&
				scope === "global" &&
				roots.length > 0 &&
				debouncedQuery.length > 0,
			staleTime: 1000,
			placeholderData: (prev) => prev ?? [],
		},
	);

	const searchResults =
		scope === "workspace"
			? singleSearch.searchResults
			: (multiSearch.data ?? []);
	const isFetching =
		scope === "workspace"
			? singleSearch.isFetching
			: multiSearch.isFetching ||
				(query.trim().length > 0 && query.trim() !== debouncedQuery);

	const handleOpenChange = useCallback((nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setQuery("");
		}
	}, []);

	const toggle = useCallback(() => {
		setOpen((prev) => {
			if (prev) {
				setQuery("");
			}
			return !prev;
		});
	}, []);

	const selectFile = useCallback(
		(filePath: string, resultWorkspaceId?: string) => {
			const targetWs = resultWorkspaceId ?? workspaceId;
			useTabsStore.getState().addFileViewerPane(targetWs, { filePath });
			handleOpenChange(false);
		},
		[workspaceId, handleOpenChange],
	);

	const setIncludePattern = useCallback(
		(value: string) => {
			setIncludePatternByMode("quickOpen", value);
		},
		[setIncludePatternByMode],
	);

	const setExcludePattern = useCallback(
		(value: string) => {
			setExcludePatternByMode("quickOpen", value);
		},
		[setExcludePatternByMode],
	);

	const setFiltersOpen = useCallback(
		(nextOpen: boolean) => {
			setFiltersOpenByMode("quickOpen", nextOpen);
		},
		[setFiltersOpenByMode],
	);

	const setScope = useCallback(
		(newScope: SearchScope) => {
			setScopeByMode("quickOpen", newScope);
		},
		[setScopeByMode],
	);

	return {
		open,
		query,
		setQuery,
		filtersOpen,
		setFiltersOpen,
		includePattern,
		setIncludePattern,
		excludePattern,
		setExcludePattern,
		handleOpenChange,
		toggle,
		selectFile,
		searchResults,
		isFetching,
		scope,
		setScope,
	};
}
