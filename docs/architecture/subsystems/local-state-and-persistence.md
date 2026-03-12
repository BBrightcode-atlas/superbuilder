# Local State and Persistence

## Role

This subsystem holds machine-local state.

It includes the desktop-local database, JSON app state files, workspace-local
home directories, and the persisted metadata that makes the desktop runtime feel
continuous across launches.

## Why it matters

The repository's execution model is not purely server-backed. A lot of important
state lives on the user's machine:

- workspace metadata
- worktree information
- settings and presets
- terminal-related state
- Atlas project metadata and local integration credentials
- UI state such as tabs, themes, and hotkeys

## Main runtime boundaries

### Shared local schema package

`packages/local-db` defines the local SQLite schema and exported types used by
desktop.

### Desktop local DB runtime

The desktop main process initializes and migrates the local DB, then uses it to
support windows, workspaces, settings, tray behavior, terminal/session logic,
and Atlas-oriented local records.

### File-backed app state

Not all local persistence is in SQLite. The desktop app also uses file-backed
JSON state for UI and window data.

## Libraries and services

- Drizzle with SQLite
- local filesystem state under the Superset-managed home directory
- lowdb for JSON app-state persistence

## Key code locations

### Local DB schema

- `packages/local-db/src/schema/`
- `packages/local-db/src/schema/atlas.ts`

This includes Atlas-specific tables for local project tracking and local
integration token storage.

### Desktop local DB runtime

- `apps/desktop/src/main/lib/local-db/index.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/windows/main.ts`
- `apps/desktop/src/main/lib/notification-sound.ts`
- `apps/desktop/src/main/lib/tray/`

### App-state and environment paths

- `apps/desktop/src/main/lib/app-state/index.ts`
- `apps/desktop/src/main/lib/app-environment.ts`
- `apps/desktop/docs/EXTERNAL_FILES.md`

## Flow

At a high level:

1. desktop resolves its managed home directory and sensitive file paths
2. app state files and the local SQLite DB are initialized on startup
3. main-process services read and write local settings, workspace metadata, and
   execution-related records
4. renderer features consume those records indirectly through desktop runtime
   services and exposed types

## Architectural consequence

This local persistence layer is one reason the system can support:

- durable workspace lists
- worktree-aware execution
- customizable terminal presets
- desktop-specific project records
- machine-local execution history and preferences

Without it, the broader development-execution system would become much more
stateless and much less practical.

## Connected subsystems

- [Workspace and Code Context](./workspace-and-code-context.md)
- [Terminal and Session Infrastructure](./terminal-and-session-infrastructure.md)
- [Desktop Agent Runtime](./desktop-agent-runtime.md)

## Constraints and migration notes

- local persistence spans both SQLite and JSON state files
- some naming and directory conventions still reflect Superset-era structure
- desktop-only local records are important enough that they should be treated as
  part of the architecture, not as incidental implementation details
