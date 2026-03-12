# Chat and Agent Conversation Runtime

## Role

This subsystem powers interactive agent conversations.

It covers the conversation host layer, provider authentication, slash command
resolution, workspace-aware file search, Mastra-backed runtime sessions, and the
desktop chat panes that expose those capabilities.

## Why it matters

The desktop agent runtime would be incomplete without a structured conversation
layer. This is the part of the system that turns raw model access into a
workspace-aware chat product.

It is also where the repository starts to unify:

- provider auth
- tool orchestration
- slash commands
- session state
- MCP-aware chat UX

## Main runtime boundaries

### Classic chat host

`packages/chat` provides a host/client split for the standard chat runtime. It
owns provider auth state, slash command resolution, workspace search helpers,
and the typed router the UI talks to.

### Mastra conversation host

`packages/chat-mastra` provides a second runtime path that is more explicitly
session-oriented and tool-oriented. It creates long-lived runtime sessions,
connects Superset MCP tools, and exposes richer display-state and approval flows.

### Desktop chat panes

Desktop exposes both runtimes as first-class panes:

- `ChatPane` for the standard path
- `ChatMastraPane` for the Mastra runtime path

## Libraries and services

- tRPC
- superjson
- Mastra / `mastracode`
- `@superset/trpc`
- provider-specific auth storage
- workspace file search and slash command utilities

## Key code locations

### Chat host

- `packages/chat/src/host/router/router.ts`
- `packages/chat/src/host/chat-service/chat-service.ts`
- `packages/chat/src/host/slash-commands/`
- `packages/chat/src/client/provider/`

### Mastra runtime

- `packages/chat-mastra/src/server/trpc/service.ts`
- `packages/chat-mastra/src/server/hono/`
- `packages/chat-mastra/src/client/provider/`
- `packages/agent/src/`

### Desktop chat UI

- `apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/TabView/ChatPane/`
- `apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/TabView/ChatMastraPane/`

## Flow

At a high level:

1. a desktop pane opens with a workspace context and session identity
2. the pane calls into either the standard chat host or the Mastra runtime
3. provider auth status, workspace slash commands, file search, and MCP overview
   are resolved through the host layer
4. message state and tool state flow back into the pane UI
5. the broader desktop runtime handles tab focus, notification hooks, and agent
   lifecycle indicators around that conversation

## Important distinction

There are effectively two conversation engines in the repo:

- a classic host-oriented chat runtime
- a Mastra-backed runtime session system

They are related, but they are not the same subsystem internally.

## Connected subsystems

- [Desktop Agent Runtime](./desktop-agent-runtime.md)
- [CLI Agent Launchers](./cli-agent-launchers.md)
- [MCP Tooling Surfaces](./mcp-tooling-surfaces.md)

## Constraints and migration notes

- the conversation layer is richer in desktop than in the web product today
- provider authentication is runtime-specific and not fully collapsed into one
  shared abstraction
- the Mastra path is the more session-heavy and MCP-heavy direction, but the
  standard chat host still matters for core workspace chat UX
