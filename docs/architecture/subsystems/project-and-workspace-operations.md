# Project and Workspace Operations

## Role

This subsystem manages how repositories become projects and how projects become
active workspaces.

It is one of the clearest examples of the repository's hybrid nature. The
remote Superset-derived platform stores organization-scoped project and
workspace metadata, while the desktop runtime maintains its own local project,
worktree, and workspace state for actual code execution.

## Why it matters

The code-to-feature-to-project story depends on this layer working cleanly.

Without it, the system cannot:

- register repos under an organization
- open local repositories into the desktop app
- create worktrees for branch or PR-based execution
- initialize per-workspace environments
- attach chat, terminal, and task workflows to a real code context

## Main libraries and runtime pieces

- tRPC for remote and desktop-local procedure surfaces
- Drizzle ORM for both remote Postgres and local SQLite records
- Electron main-process services for workspace orchestration
- `simple-git` plus git helpers for repo and worktree manipulation
- Hono for the lightweight workspace-service HTTP and tRPC surface

## Key code locations

### Remote organization-scoped metadata

- `packages/trpc/src/router/project/project.ts`
- `packages/trpc/src/router/workspace/workspace.ts`

These routers manage the remote record layer:

- project creation and updates under an organization
- workspace records linked to projects
- membership and org-admin verification before mutations
- `workspace.ensure`, which can upsert a project and a workspace together

This is the platform-facing metadata model, not the local execution model.

### Desktop-local project operations

- `apps/desktop/src/lib/trpc/routers/projects/projects.ts`
- `apps/desktop/src/lib/trpc/routers/projects/utils/github.ts`
- `apps/desktop/src/lib/trpc/routers/projects/utils/favicon-discovery.ts`
- `apps/desktop/src/lib/trpc/routers/projects/utils/colors/`

This layer handles the local desktop meaning of a project:

- importing an existing repo from disk
- initializing a repo when the selected folder is not yet a git repo
- choosing default branch and local metadata
- discovering icons and GitHub owner context
- creating the default branch workspace for a repo

These records are stored in the desktop local database, not the remote
organization database.

### Desktop-local workspace operations

- `apps/desktop/src/lib/trpc/routers/workspaces/workspaces.ts`
- `apps/desktop/src/lib/trpc/routers/workspaces/procedures/create.ts`
- `apps/desktop/src/lib/trpc/routers/workspaces/procedures/init.ts`
- `apps/desktop/src/lib/trpc/routers/workspaces/procedures/query.ts`
- `apps/desktop/src/lib/trpc/routers/workspaces/procedures/status.ts`
- `apps/desktop/src/lib/trpc/routers/workspaces/procedures/git-status.ts`
- `apps/desktop/src/lib/trpc/routers/workspaces/utils/`

This is where desktop workspaces become operational:

- branch and PR worktree creation
- sidebar grouping and ordering
- initialization progress reporting
- git status inspection
- setup command loading
- auto-rename and base-branch resolution

### Local persistence and runtime services

- `apps/desktop/src/main/lib/local-db/`
- `apps/desktop/src/main/lib/workspace-init-manager.ts`
- `apps/desktop/src/main/lib/workspace-service-manager.ts`
- `apps/desktop/src/main/lib/workspace-runtime/registry.ts`
- `packages/workspace-service/src/index.ts`
- `packages/workspace-service/src/trpc/router/router.ts`

These files are the bridge from stored workspace records to actual execution
services.

`workspace-service-manager` runs per-organization helper processes. The
workspace runtime registry currently routes everything to a local runtime, but
its interface is already shaped for future local-versus-cloud selection.

## Operational flow

At a high level:

1. an organization-level project or workspace can be registered through the
   shared `packages/trpc` routers
2. on desktop, a repository is imported or initialized and stored in the local
   SQLite project table
3. the desktop workspace routers create a branch workspace or a separate
   worktree-backed workspace
4. workspace initialization loads setup config, emits init progress, and
   prepares the worktree for chat, terminals, tasks, and agent flows
5. the workspace runtime and workspace-service provide long-lived support
   processes behind the desktop UX

The important structural point is that "project" and "workspace" mean two
slightly different things depending on whether you are looking at the remote
product model or the local execution model.

## Connected subsystems

- [Workspace and Code Context](./workspace-and-code-context.md)
- [Terminal and Session Infrastructure](./terminal-and-session-infrastructure.md)
- [Tasks System](./tasks-system.md)
- [Feature and Project Engine](./feature-and-project-engine.md)

## Current constraints

- there is still a split-brain model between remote org-scoped project records
  and desktop-local execution records
- the workspace runtime registry is already cloud-ready in shape, but current
  behavior still defaults everything to a local runtime
- the desktop layer owns the richest workspace lifecycle logic today, so web and
  API metadata alone do not describe how code execution really works
