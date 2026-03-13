# Terminal and Session Infrastructure

## Role

This subsystem provides persistent terminal execution.

It manages PTY creation, session attach/detach, cold restore, history capture,
daemon supervision, and the renderer terminal UI that sits on top of those
backend capabilities.

## Why it matters

A large part of the repository's development-execution story depends on durable
terminal behavior:

- agent CLIs run in terminals
- workspaces need reconnectable shells
- output must survive tab changes and process restarts when possible
- terminal state feeds back into desktop pane status and execution history

## Main runtime boundaries

### Terminal host

The terminal host is the lower-level daemon-facing session manager. It owns
session lifecycle, socket attachment, process spawning, and forced cleanup.

### Terminal manager and daemon layer

The daemon manager in the main process tracks session metadata, history, killed
session tombstones, cold restore info, and daemon reconnect behavior.

### Renderer terminal pane

The renderer terminal UI handles user interaction, display state, scrollback
presentation, link providers, restore overlays, and attach scheduling.

## Libraries and services

- `node-pty`
- `@xterm/headless`
- xterm serialization/addons
- socket-based host connection
- desktop-local history persistence

## Key code locations

### Terminal host

- `apps/desktop/src/main/terminal-host/terminal-host.ts`
- `apps/desktop/src/main/terminal-host/session.ts`
- `apps/desktop/src/main/terminal-host/pty-subprocess.ts`

### Main-process terminal infrastructure

- `apps/desktop/src/main/lib/terminal/session.ts`
- `apps/desktop/src/main/lib/terminal/daemon/daemon-manager.ts`
- `apps/desktop/src/main/lib/terminal/history-manager.ts`
- `apps/desktop/src/main/lib/terminal/env.ts`
- `apps/desktop/src/main/lib/terminal-history.ts`

### Renderer terminal UI

- `apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/Terminal/Terminal.tsx`
- `apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/Terminal/hooks/`
- `apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/Terminal/attach-scheduler.ts`
- `apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/Terminal/link-providers/`

## Flow

At a high level:

1. a pane requests create-or-attach for a terminal session
2. the host either spawns a new PTY or reattaches to an existing live session
3. session output is batched, serialized, and persisted into history
4. renderer hooks stream output and reconcile UI state
5. if the user detaches, closes a tab, or restarts the app, restore paths try to
   reconnect to the daemon session rather than starting from nothing

## Important architectural detail

This is not a thin wrapper around a single terminal widget. The subsystem is
intentionally multi-layered so that process lifetime is decoupled from pane
lifetime.

That design is what allows the repo to support long-running agents and
workspace-level execution rather than disposable toy terminals.

## Connected subsystems

- [Desktop Agent Runtime](./desktop-agent-runtime.md)
- [CLI Agent Launchers](./cli-agent-launchers.md)
- [Local State and Persistence](./local-state-and-persistence.md)

## Constraints and migration notes

- terminal correctness depends on several cooperating layers, so bugs often span
  host, daemon manager, history, and renderer code
- session recovery and replay are a major concern in this architecture
- this subsystem is one of the strongest examples of why the desktop app is a
  real runtime environment, not only a shell around web content
