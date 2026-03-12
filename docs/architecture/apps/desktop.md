# Desktop App

## Role

`apps/desktop` is the thickest client in the repository and likely the flagship
operational surface of the current system.

It provides a local-first workstation for running coding agents, managing
workspaces, reviewing changes, handling terminals, and coordinating tool and MCP
workflows from a native shell.

## Runtime and framework

- Electron
- separate main, preload, and renderer processes
- TanStack Router in the renderer
- local persistence via `@superset/local-db`
- shared auth via `@superset/auth`
- workspace orchestration via `@superset/workspace-service`
- heavy agent and terminal tooling

## Process boundaries

### Main process

The main process handles:

- app lifecycle
- native window management
- deep links and protocol handling
- tray behavior
- auto-update
- terminal/session reconciliation
- native integrations and service managers

### Preload

The preload layer exposes carefully controlled APIs into the renderer:

- electron-trpc bridge
- low-level IPC helpers
- selected app metadata and file path utilities

This is the security boundary between the browser-like renderer and full Node/Electron access.

### Renderer

The renderer behaves like a large SPA:

- route-driven UI
- analytics and boot-error handling
- persistent history
- typed query clients
- workspace and agent UX

## Key supporting packages

- `@superset/auth`
- `@superset/chat`
- `@superset/chat-mastra`
- `@superset/db`
- `@superset/desktop-mcp`
- `@superset/local-db`
- `@superset/trpc`
- `@superset/ui`
- `@superset/workspace-service`
- `@superbuilder/atlas-engine`

This mix shows the desktop app is also where the Superset-derived foundation and
the newer superbuilder feature layer meet most visibly.

## Architectural role in the whole system

The desktop app acts as the local orchestration shell for:

- coding agents
- workspace management
- MCP and tool execution
- terminal-driven development flows
- task and diff review

It is not a thin wrapper around `apps/web`; it is its own runtime environment.
