# Desktop Agent Runtime

## Role

This subsystem is the local orchestration layer of the system.

It turns the Electron app into more than a viewer: the desktop runtime manages
workspaces, terminals, chat panes, MCP access, notification hooks, and agent
status across a local coding environment.

## Why it matters

The broader `superbuilder` direction depends on a thick local client that can
see code, run tools, open workspaces, and coordinate agent activity close to the
developer's machine.

This is the main place where code context, tool execution, terminal state, and
agent UX meet.

## Runtime boundaries

### Main process

The main process owns process-level orchestration:

- terminal and PTY lifecycle
- workspace runtime selection and initialization
- notification server and hook setup
- workspace-service process management
- local agent wrapper installation

### Preload

The preload layer exposes a narrow bridge for the renderer, including IPC and
Electron-flavored tRPC access.

### Renderer

The renderer owns the interactive workspace shell:

- workspace sidebar and workspace list
- tabbed content panes
- chat panes and Mastra chat panes
- file, diff, browser, and terminal views
- task navigation and workspace-linked execution flows

## Libraries and services

- Electron
- TanStack Router
- local tRPC bridge via `electronTrpc`
- `@superset/chat`
- `@superset/chat-mastra`
- `@superset/desktop-mcp`
- `@superset/local-db`
- `@superset/workspace-service`

## Key code locations

### Main/runtime orchestration

- `apps/desktop/src/main/lib/terminal/`
- `apps/desktop/src/main/terminal-host/`
- `apps/desktop/src/main/lib/workspace-runtime/`
- `apps/desktop/src/main/lib/workspace-init-manager.ts`
- `apps/desktop/src/main/lib/workspace-service-manager.ts`
- `apps/desktop/src/main/lib/notifications/server.ts`
- `apps/desktop/src/main/lib/agent-setup/`

### Renderer shell

- `apps/desktop/src/renderer/screens/main/components/WorkspaceSidebar/`
- `apps/desktop/src/renderer/screens/main/components/WorkspaceView/`
- `apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/`
- `apps/desktop/src/renderer/stores/tabs/useAgentHookListener.ts`

### Supporting packages

- `packages/chat/src/host/`
- `packages/chat-mastra/src/server/`
- `packages/desktop-mcp/src/mcp/`

## Event flow

At a high level the desktop runtime works like this:

1. the main process sets up workspace-scoped binaries, hook scripts, and
   terminal environment
2. a user opens a workspace, chat pane, terminal, or task-linked execution flow
3. the terminal or chat runtime runs an external agent or an internal tool path
4. notification hooks emit lifecycle events back to desktop
5. the renderer subscribes to those events and updates pane status, review
   badges, and navigation state

This is why agent lifecycle feedback is not isolated to a single chat component.
It is a desktop-wide coordination concern.

## Connected subsystems

- [CLI Agent Launchers](./cli-agent-launchers.md)
- [Workspace and Code Context](./workspace-and-code-context.md)
- [Tasks System](./tasks-system.md)
- [Auth and Organization Model](./auth-and-organization-model.md)

## Current constraints

- the desktop app still carries Superset-era naming in app IDs, paths, and
  workspace directories
- some flows are orchestrated by local processes rather than by a single remote
  backend
- the system is intentionally stateful on the local machine, so workspace and
  terminal behavior cannot be understood only from web app code
