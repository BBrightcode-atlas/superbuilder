# Dev Execution Subsystems Design

## Goal

Extend the subsystem architecture docs with a second batch focused on the
developer execution layer.

This batch should explain how the repository supports interactive coding work
through chat, agent orchestration, MCP tools, terminal/session infrastructure,
and local persistence.

## Why this batch matters

The current subsystem docs already explain:

- desktop agent runtime
- CLI agent launchers
- tasks
- workspace and code context
- feature/project engine
- auth/org model
- sync/integrations

What is still missing is the deeper execution stack underneath those features:

- how chat runtimes are structured
- how MCP is exposed as a tool surface
- how terminal/session infrastructure actually works
- how local state is persisted on the machine

## Recommended document set

Add these subsystem documents:

- `docs/architecture/subsystems/chat-and-agent-conversation-runtime.md`
- `docs/architecture/subsystems/mcp-tooling-surfaces.md`
- `docs/architecture/subsystems/terminal-and-session-infrastructure.md`
- `docs/architecture/subsystems/local-state-and-persistence.md`

Update subsystem indexes and the main architecture index so these documents are
part of the recommended reading order.

## Document scope

### Chat and agent conversation runtime

Cover:

- `packages/chat`
- `packages/chat-mastra`
- `packages/agent`
- desktop chat panes and Mastra chat panes
- how conversation UX, slash commands, host services, and provider logic are split

### MCP tooling surfaces

Cover:

- `packages/mcp`
- `packages/desktop-mcp`
- desktop MCP-aware UI touchpoints
- how internal capabilities become MCP tools

### Terminal and session infrastructure

Cover:

- desktop PTY lifecycle
- terminal host and daemon layers
- terminal attach/reconnect behavior
- renderer terminal panes
- how this supports agent CLI execution

### Local state and persistence

Cover:

- `packages/local-db`
- app state files and workspace-local state
- durable desktop runtime assumptions
- which state is local-only versus server-backed

## Writing constraints

- keep the same architecture-first format as the first subsystem batch
- include real code paths, but no code walkthroughs
- explicitly connect these docs back to the already-written desktop/runtime docs
- clarify which pieces are product infrastructure versus developer execution infrastructure
