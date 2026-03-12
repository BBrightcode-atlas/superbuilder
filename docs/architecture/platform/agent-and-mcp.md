# Agent and MCP Architecture

## Summary

Agent execution and MCP are not edge features in this repository. They are a
core part of how the product is built.

The architecture spans:

- shared agent packages
- shared chat packages
- MCP packages
- desktop orchestration
- API-hosted agent endpoints
- feature-platform agent services
- remote-control utilities

## Main Superset-side agent architecture

### `@superset/agent`

Provides agent-oriented primitives and model/runtime helpers. The package shows
Mastra-based orchestration and tool definitions rather than app-specific UI.

### `@superset/chat`

Provides shared chat contracts and host/client abstractions. It acts as a common
layer between front-end chat surfaces and agent backends.

### `@superset/chat-mastra`

Bridges the chat system with Mastra-specific runtime behavior and exports both
client and server-facing entry points.

### `@superset/mcp`

Provides an MCP server surface with registered tools, making internal product
capabilities available through MCP.

### `@superset/desktop-mcp`

Packages desktop-specific MCP integration so the Electron app can expose or
consume MCP functionality locally.

## Desktop as the orchestration shell

The Electron desktop app is where many of these pieces come together.

It is the best place in the repo to think about “agent operations” as a product:

- workspaces
- terminals
- tool execution
- diff review
- deep links
- local services
- MCP-aware interactions

The desktop app is therefore both a client and an orchestrator.

## API-layer participation

`apps/api` hosts:

- chat endpoints
- agent transport endpoints
- integration surfaces that agents can rely on

This means agent functionality is not confined to the desktop runtime. Some of
it is service-hosted and can be reused across clients.

## Feature-platform agent architecture

The integrated feature stack has its own AI runtime shape:

- `apps/agent-server` hosts model routing, tools, chat, threads, and usage flows
- `packages/features-server` exposes feature-side logic and contracts
- `apps/features-app` consumes those agent-oriented capabilities in UI

This is a second agent architecture inside the repo, parallel to the main
Superset product stack.

## Remote-control and automation support

`apps/workers` adds another dimension: remote browser or IDE control and webhook
automation.

That suggests the repository supports both:

- agent-driven reasoning and tool calling
- system-level automation against external or remote environments

## Architectural consequence

There is no single “agent module”.

Instead, the repo implements agent capability as a layered system:

1. core agent and chat packages
2. MCP tool surfaces
3. service endpoints in API or agent servers
4. rich orchestration UX in the desktop client
5. external automation helpers in worker-style services
