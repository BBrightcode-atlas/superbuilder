# Workspace and Code Context

## Role

This subsystem manages local code context.

It is responsible for representing projects and workspaces, initializing local
workspace state, keeping local service processes alive, and giving desktop tools
and agents a stable view of the filesystem they are operating on.

## Why it matters

The broader superbuilder workflow starts from code, not from isolated forms.
That means the system needs a durable local concept of:

- projects
- workspaces
- worktrees
- files
- changes
- terminal sessions

This subsystem provides that foundation.

## Runtime boundaries

### Desktop local runtime

The Electron main process manages local workspace selection, worktree init
progress, and per-workspace runtime behavior.

### Workspace service

`packages/workspace-service` is a lightweight Hono + tRPC service that desktop
can start and supervise. It represents a separate service boundary even though
today its public router remains intentionally small.

### Renderer workspace shell

The renderer is where users interact with workspace state: workspace sidebars,
workspace lists, file views, diff views, and workspace tab content.

## Libraries and services

- Electron
- Hono
- tRPC
- local process spawning and supervision
- worktree-oriented local filesystem management

## Key code locations

### Desktop workspace management

- `apps/desktop/src/main/lib/workspace-runtime/`
- `apps/desktop/src/main/lib/workspace-init-manager.ts`
- `apps/desktop/src/main/lib/workspace-service-manager.ts`
- `apps/desktop/src/shared/worktree-id.ts`
- `apps/desktop/src/shared/types/workspace-init.ts`

### Workspace service

- `packages/workspace-service/src/index.ts`
- `packages/workspace-service/src/serve.ts`
- `packages/workspace-service/src/trpc/router/`

### Renderer workspace UX

- `apps/desktop/src/renderer/routes/_authenticated/_dashboard/workspaces/page.tsx`
- `apps/desktop/src/renderer/screens/main/components/WorkspaceSidebar/`
- `apps/desktop/src/renderer/screens/main/components/WorkspaceView/`
- `apps/desktop/src/renderer/screens/main/components/WorkspacesListView/`

## Flow

The subsystem roughly works like this:

1. desktop creates or opens a workspace/worktree context
2. initialization progress is tracked in-memory and streamed to the renderer
3. the main process selects a runtime provider for that workspace
4. desktop starts or reconnects to a workspace service process as needed
5. renderer views consume workspace state to show files, changes, tabs, ports,
   and related agent surfaces

## Important architectural detail

The workspace runtime registry is already designed as if multiple runtime types
could exist, even though current behavior still routes everything through the
local runtime.

That means this subsystem is already shaped for future local-plus-cloud
coexistence.

## Constraints and migration notes

- initialization tracking is currently process-local and not durable across
  app restarts
- workspace-service is a real boundary, but still intentionally small
- the local workspace model is one of the strongest places where the Superset
  foundation and the newer superbuilder workflow align
