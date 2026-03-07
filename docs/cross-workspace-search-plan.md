# Cross-Workspace Search — Implementation Plan

## Goal

Enhance the command palette (`Cmd+P`) so users can optionally search across all workspaces, not just the current one. Keep memory usage low with LRU-capped Fuse.js indexes.

---

## Current Architecture

```
Workspace Page
  └─ useCommandPalette({ workspaceId, worktreePath })
       └─ useFileSearch({ worktreePath, searchTerm, ... })
            └─ tRPC: filesystem.searchFiles({ rootPath: worktreePath, query, ... })
                 └─ getSearchIndex(rootPath) → Fuse.js index (cached 30s)
```

- Each workspace provides a single `worktreePath`
- `getSearchIndex()` caches a Fuse.js index per `rootPath` with a 30-second TTL
- Results are scoped to one directory tree — no way to search across workspaces

---

## Design

### Scope Modes

| Mode | Behavior |
|------|----------|
| `workspace` (default) | Searches current workspace only (existing behavior) |
| `global` | Searches across all open workspaces |

The user toggles between modes via a button in the command palette header. The current scope is persisted in the search dialog Zustand store.

### Memory Budget

LRU cache capped at **3 indexes**. Worst-case memory: ~45 MB (3 large monorepos). Typical: ~10-25 MB.

---

## Changes by Layer

### 1. Backend — `filesystem/index.ts`

#### Replace TTL cache with LRU cache

The current cache is a `Map<string, FileSearchCacheEntry>` with a 30-second TTL. Replace it with an LRU cache (cap: 3).

```typescript
// Before
const searchIndexCache = new Map<string, FileSearchCacheEntry>();

// After
import { LRUCache } from "lru-cache";

const searchIndexCache = new LRUCache<string, FileSearchCacheEntry>({
  max: 3,
  // Keep TTL for freshness — stale indexes get rebuilt on next access
  ttl: 30_000,
  // Allow returning stale data while rebuilding
  allowStale: true,
});
```

Use the [`lru-cache`](https://github.com/isaacs/node-lru-cache) package (lightweight, no deps). The existing `getSearchIndex()` function already handles stale-while-revalidate — just swap the backing store.

#### Add `searchFilesMulti` procedure

New tRPC procedure that searches multiple roots and merges results:

```typescript
searchFilesMulti: publicProcedure
  .input(z.object({
    roots: z.array(z.object({
      rootPath: z.string(),
      workspaceId: z.string(),
      workspaceName: z.string(),
    })),
    query: z.string(),
    includePattern: z.string().default(""),
    excludePattern: z.string().default(""),
    limit: z.number().default(50),
  }))
  .query(async ({ input }) => {
    const { roots, query, includePattern, excludePattern, limit } = input;
    if (!query.trim()) return [];

    const perRootLimit = Math.max(10, Math.ceil(limit / roots.length));

    // Search each root in parallel
    const allResults = await Promise.all(
      roots.map(async (root) => {
        const index = await getSearchIndex(root.rootPath);
        const pathMatcher = createPathFilterMatcher({ includePattern, excludePattern });
        const items = pathMatcher.hasFilters
          ? index.items.filter((item) => matchesPathFilters(item.relativePath, pathMatcher))
          : index.items;

        const fuse = pathMatcher.hasFilters
          ? createFileSearchFuse(items)
          : index.fuse;

        return fuse.search(query, { limit: perRootLimit }).map((result) => ({
          ...result.item,
          score: 1 - (result.score ?? 0),
          workspaceId: root.workspaceId,
          workspaceName: root.workspaceName,
        }));
      })
    );

    // Merge, sort by score descending, truncate
    return allResults
      .flat()
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }),
```

Key decisions:
- **Parallel search** — all roots searched concurrently via `Promise.all`
- **Per-root cap** — `ceil(limit / roots.length)` prevents any single workspace from dominating results, while still getting enough candidates for a good merge
- **Server-side merge** — only the top `limit` results cross IPC, keeping renderer memory flat
- **LRU pressure** — with cap 3, searching 20 workspaces evicts old indexes as it goes. The current workspace's index stays hot because it was most recently accessed

#### Deduplicate shared worktree paths

Multiple workspaces can share the same `worktreePath` (e.g. branch-type workspaces on the same repo). Deduplicate roots before searching to avoid indexing the same directory twice:

```typescript
// Inside searchFilesMulti, before searching
const seen = new Map<string, typeof roots[0]>();
for (const root of roots) {
  if (!seen.has(root.rootPath)) {
    seen.set(root.rootPath, root);
  }
}
const uniqueRoots = [...seen.values()];
```

Results from a shared root get tagged with the first workspace that uses it. This is fine — the file path is the same either way.

---

### 2. Renderer — State

#### Extend `SearchDialogState`

Add a `scope` field to the quickOpen mode state:

**File:** `renderer/stores/search-dialog-state.ts`

```typescript
type SearchScope = "workspace" | "global";

interface SearchDialogModeState {
  includePattern: string;
  excludePattern: string;
  filtersOpen: boolean;
  scope: SearchScope; // NEW
}

// Add setter
interface SearchDialogState {
  // ... existing
  setScope: (mode: SearchDialogMode, scope: SearchScope) => void;
}
```

Default to `"workspace"`. Persisted via the existing Zustand persist middleware so the user's preference survives restarts.

---

### 3. Renderer — Hook

#### Extend `useCommandPalette`

Add global search support alongside the existing single-workspace search:

**File:** `screens/main/components/CommandPalette/useCommandPalette.ts`

```typescript
interface UseCommandPaletteParams {
  workspaceId: string;
  worktreePath: string | undefined;
}

export function useCommandPalette({ workspaceId, worktreePath }: UseCommandPaletteParams) {
  // ... existing state (open, query, filters)

  const scope = useSearchDialogStore((s) => s.byMode.quickOpen.scope);

  // Fetch all workspaces (only used when scope === "global")
  const { data: allWorkspaces } = electronTrpc.workspaces.getAll.useQuery(
    undefined,
    { enabled: scope === "global" },
  );

  // Build roots array for multi-search
  const roots = useMemo(() => {
    if (scope !== "global" || !allWorkspaces) return [];
    return allWorkspaces
      .filter((ws) => ws.worktreePath)
      .map((ws) => ({
        rootPath: ws.worktreePath,
        workspaceId: ws.id,
        workspaceName: [ws.project?.name, ws.name].filter(Boolean).join(" - "),
      }));
  }, [scope, allWorkspaces]);

  // Single-workspace search (existing)
  const singleSearch = useFileSearch({
    worktreePath: open && scope === "workspace" ? worktreePath : undefined,
    searchTerm: query,
    includePattern,
    excludePattern,
    limit: SEARCH_LIMIT,
  });

  // Multi-workspace search (new)
  const debouncedQuery = useDebouncedValue(query.trim(), 150);
  const multiSearch = electronTrpc.filesystem.searchFilesMulti.useQuery(
    { roots, query: debouncedQuery, includePattern, excludePattern, limit: SEARCH_LIMIT },
    {
      enabled: open && scope === "global" && roots.length > 0 && debouncedQuery.length > 0,
      staleTime: 1000,
      placeholderData: (prev) => prev ?? [],
    },
  );

  // Merge into single interface
  const searchResults = scope === "workspace" ? singleSearch.searchResults : (multiSearch.data ?? []);
  const isFetching = scope === "workspace" ? singleSearch.isFetching : multiSearch.isFetching;

  const selectFile = useCallback(
    (filePath: string, resultWorkspaceId?: string) => {
      const targetWs = resultWorkspaceId ?? workspaceId;
      useTabsStore.getState().addFileViewerPane(targetWs, { filePath });
      handleOpenChange(false);
    },
    [workspaceId, handleOpenChange],
  );

  // ... return everything + scope, setScope, selectFile (now accepts workspaceId)
}
```

---

### 4. Renderer — UI

#### Update `CommandPalette.tsx`

Add scope toggle and workspace badges on results:

```tsx
export function CommandPalette({ scope, onScopeChange, ...props }: CommandPaletteProps) {
  return (
    <SearchDialog
      // ... existing props
      headerExtra={
        <ScopeToggle scope={scope} onScopeChange={onScopeChange} />
      }
      renderItem={(file) => (
        <>
          <FileIcon fileName={file.name} className="size-3.5 shrink-0" />
          <span className="truncate font-medium">{file.name}</span>
          {scope === "global" && file.workspaceName && (
            <span className="shrink-0 text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {file.workspaceName}
            </span>
          )}
          <span className="truncate text-muted-foreground text-xs ml-auto">
            {file.relativePath}
          </span>
        </>
      )}
    />
  );
}
```

#### `ScopeToggle` component

Small segmented control or button in the search header:

```tsx
function ScopeToggle({ scope, onScopeChange }: {
  scope: SearchScope;
  onScopeChange: (scope: SearchScope) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <button
        onClick={() => onScopeChange("workspace")}
        className={cn("px-2 py-0.5 rounded", scope === "workspace" && "bg-muted text-foreground")}
      >
        This workspace
      </button>
      <button
        onClick={() => onScopeChange("global")}
        className={cn("px-2 py-0.5 rounded", scope === "global" && "bg-muted text-foreground")}
      >
        All workspaces
      </button>
    </div>
  );
}
```

#### Update `SearchDialog.tsx`

Add a `headerExtra` prop to render the scope toggle between the search input and the results list:

```tsx
interface SearchDialogProps<TItem> {
  // ... existing
  headerExtra?: ReactNode;
}

// Render headerExtra below the filter row / above the results list
```

---

### 5. File Selection Across Workspaces

When a user selects a file from a different workspace in global mode:

1. `selectFile` receives the result's `workspaceId`
2. Calls `useTabsStore.getState().addFileViewerPane(resultWorkspaceId, { filePath })`
3. This opens the file in the target workspace's tab group

This already works — `addFileViewerPane` accepts any `workspaceId`. No navigation is required; the file opens in the target workspace's tabs and the user can switch to it.

---

## File Manifest

| File | Action |
|------|--------|
| `apps/desktop/src/lib/trpc/routers/filesystem/index.ts` | Add LRU cache, add `searchFilesMulti` procedure |
| `apps/desktop/src/renderer/stores/search-dialog-state.ts` | Add `scope` field and `setScope` setter |
| `apps/desktop/src/renderer/screens/main/components/CommandPalette/useCommandPalette.ts` | Add global search branch, extend `selectFile` |
| `apps/desktop/src/renderer/screens/main/components/CommandPalette/CommandPalette.tsx` | Add scope toggle, workspace badges on results |
| `apps/desktop/src/renderer/screens/main/components/SearchDialog/SearchDialog.tsx` | Add `headerExtra` prop |
| `apps/desktop/src/renderer/screens/main/components/CommandPalette/components/ScopeToggle/ScopeToggle.tsx` | **New** — scope toggle UI |
| `apps/desktop/src/renderer/screens/main/components/CommandPalette/components/ScopeToggle/index.ts` | **New** — barrel export |
| `apps/desktop/src/renderer/routes/_authenticated/_dashboard/workspace/$workspaceId/page.tsx` | Pass `scope`/`setScope` to `CommandPalette` |
| `package.json` (apps/desktop) | Add `lru-cache` dependency |

---

## Edge Cases

| Case | Handling |
|------|----------|
| Only 1 workspace open | Scope toggle still shown but "All workspaces" behaves same as "This workspace" |
| Workspace has no worktreePath | Filtered out of `roots` array — skipped in global search |
| Duplicate worktreePaths | Deduplicated server-side before indexing |
| LRU eviction mid-search | `getSearchIndex` rebuilds evicted index on demand — adds latency for that root but results still arrive |
| User switches scope while results are loading | tRPC query is disabled for the inactive scope — React Query cancels the in-flight request |
| No workspaces open (home page) | Command palette not rendered (existing behavior — guarded by `workspaceId` check in TopBar) |

---

## Memory Profile

| LRU Cap | Typical (mixed repos) | Worst Case (large monorepos) |
|---------|----------------------|------------------------------|
| 3 | 10–25 MB | ~45 MB |

Indexes are evicted oldest-first. The current workspace's index stays hot. In practice, a global search across 20 workspaces will churn through indexes but only keep 3 resident at any time.
