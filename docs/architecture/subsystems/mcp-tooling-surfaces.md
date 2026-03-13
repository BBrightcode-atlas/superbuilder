# MCP Tooling Surfaces

## Role

This subsystem exposes internal capabilities as MCP servers and MCP tools.

It is the part of the architecture that makes product actions available through
agent-compatible tool contracts rather than only through application UIs.

## Why it matters

MCP is one of the main ways this repository turns product functionality into
agent-usable functionality.

That matters for both:

- external or embedded agent runtimes
- desktop-local automation against a live application window

## Main runtime boundaries

### Product MCP server

`packages/mcp` defines the general Superset MCP server. It registers tools for
tasks, devices, workspaces, organizations, and agent session actions.

### Desktop automation MCP server

`packages/desktop-mcp` defines a separate MCP surface focused on desktop/browser
automation. It exposes tools like screenshotting, DOM inspection, navigation,
clicking, typing, and console inspection.

### Desktop chat integration

Desktop chat and Mastra panes expose MCP awareness in the UI, including MCP
overview and server-auth interactions.

## Libraries and services

- `@modelcontextprotocol/sdk`
- desktop browser/page automation stack
- typed tool registration modules
- MCP-aware chat UI

## Key code locations

### Product MCP

- `packages/mcp/src/server.ts`
- `packages/mcp/src/tools/index.ts`
- `packages/mcp/src/tools/tasks/`
- `packages/mcp/src/tools/devices/`
- `packages/mcp/src/tools/organizations/`

### Desktop MCP

- `packages/desktop-mcp/src/mcp/mcp-server.ts`
- `packages/desktop-mcp/src/mcp/connection/`
- `packages/desktop-mcp/src/mcp/tools/`
- `packages/desktop-mcp/src/mcp/focus-lock/`
- `packages/desktop-mcp/src/mcp/dom-inspector/`
- `packages/desktop-mcp/src/mcp/console-capture/`

### Desktop UI touchpoints

- `apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/TabView/ChatPane/ChatInterface/hooks/useSlashCommandExecutor/`
- `apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/TabView/ChatMastraPane/ChatMastraInterface/hooks/useMcpUi/`
- `apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/TabView/ChatMastraPane/ChatMastraInterface/components/McpControls/`

## Flow

There are two complementary MCP patterns here.

### Product-action MCP

1. the Superset MCP server starts and registers business tools
2. tools bridge into application capabilities such as tasks, workspaces,
   devices, and agent session setup
3. agent runtimes can call these tools instead of scraping UI state

### Desktop-automation MCP

1. the desktop MCP server manages a live page/browser connection
2. automation tools act on that page or inspect its state
3. agents can use those tools to drive or observe a desktop/browser surface

## Architectural consequence

The repository does not treat MCP as a single feature. It uses MCP in at least
two ways:

- as an application capability surface
- as a local automation capability surface

That split is useful when debugging because tool failures may come from very
different layers.

## Connected subsystems

- [Chat and Agent Conversation Runtime](./chat-and-agent-conversation-runtime.md)
- [Desktop Agent Runtime](./desktop-agent-runtime.md)
- [Tasks System](./tasks-system.md)

## Constraints and migration notes

- product MCP and desktop MCP are separate servers with different purposes
- MCP appears in both backend/package code and desktop UI code
- the more agent-centric the repository becomes, the more these MCP surfaces act
  as stable execution interfaces across the rest of the system
