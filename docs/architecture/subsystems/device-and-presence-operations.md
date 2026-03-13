# Device and Presence Operations

## Role

This subsystem tracks which client devices are online and available within an
organization context.

It is the operational layer that lets desktop and mobile presence become part of
the shared product model.

## Why it matters

The repository spans desktop, mobile, and other device-aware flows. A
centralized device-presence model lets the system treat those endpoints as part
of a shared workspace rather than as isolated clients.

It also creates a bridge to higher-level tooling like device-oriented MCP tools.

## Main runtime boundaries

### Device presence API

The device router owns heartbeat registration and online-device listing.

### Client participation

Desktop and mobile are the main clients expected to announce device presence.

### Device-aware tool surfaces

The MCP layer also contains device-oriented tools for workspace and agent
session actions, which makes device concepts usable from agent workflows.

## Libraries and services

- tRPC
- Drizzle ORM
- active-organization-aware auth context
- MCP tools for device and workspace actions

## Key code locations

### Device typed API

- `packages/trpc/src/router/device/device.ts`

### Related schema usage

- device presence is queried from the main DB schema through the TRPC layer

### Device-aware MCP tools

- `packages/mcp/src/tools/devices/`

### Client surfaces

- desktop and mobile clients participate through authenticated product sessions

## Flow

At a high level:

1. a client sends a heartbeat with device identity and type
2. the active organization is read from session context
3. presence is inserted or upserted for that user/device pair
4. online devices are computed by filtering recent heartbeats
5. device-aware product or MCP flows can use that state as a lightweight online
   device inventory

## Architectural consequence

This subsystem is small in code volume compared to others, but it matters
because it lets the product reason about active endpoints inside an organization.

That becomes more important as the repo leans further into multi-device and
agent-assisted workflows.

## Connected subsystems

- [Organization and Member Operations](./organization-and-member-operations.md)
- [MCP Tooling Surfaces](./mcp-tooling-surfaces.md)
- [Desktop Agent Runtime](./desktop-agent-runtime.md)

## Constraints and migration notes

- presence currently looks lightweight and heartbeat-based rather than like a
  full remote-device control plane
- even so, the existence of both presence APIs and device MCP tools suggests the
  architecture is prepared for richer device-aware workflows
