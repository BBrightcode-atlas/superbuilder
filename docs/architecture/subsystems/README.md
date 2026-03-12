# Subsystem Guide

This section complements the app-by-app architecture docs.

The app documents explain where runtime surfaces live. The subsystem documents
explain where major capabilities actually come from: which apps participate,
which packages hold the logic, which libraries are involved, and where to find
the real code.

## Recommended reading order

1. [Desktop Agent Runtime](./desktop-agent-runtime.md)
2. [CLI Agent Launchers](./cli-agent-launchers.md)
3. [Chat and Agent Conversation Runtime](./chat-and-agent-conversation-runtime.md)
4. [MCP Tooling Surfaces](./mcp-tooling-surfaces.md)
5. [Terminal and Session Infrastructure](./terminal-and-session-infrastructure.md)
6. [Local State and Persistence](./local-state-and-persistence.md)
7. [Workspace and Code Context](./workspace-and-code-context.md)
8. [Project and Workspace Operations](./project-and-workspace-operations.md)
9. [Tasks System](./tasks-system.md)
10. [Feature and Project Engine](./feature-and-project-engine.md)
11. [Feature Vertical Map](./feature-vertical-map.md)
12. [Integration Provider Surfaces](./integration-provider-surfaces.md)
13. [Billing and Subscription Operations](./billing-and-subscription-operations.md)
14. [Organization and Member Operations](./organization-and-member-operations.md)
15. [Device and Presence Operations](./device-and-presence-operations.md)
16. [Analytics and Observability](./analytics-and-observability.md)
17. [Auth and Organization Model](./auth-and-organization-model.md)
18. [Sync and Integrations](./sync-and-integrations.md)
19. [Deployment and Runtime Topology](./deployment-and-runtime-topology.md)

## What these docs are for

Use this section when you want to answer questions like:

- where Claude, Codex, Gemini, OpenCode, Cursor Agent, or Copilot are launched
- how chat panes, Mastra sessions, slash commands, and provider auth are split
- where MCP servers and MCP tools are defined
- how terminal sessions survive detach, reconnect, and restore flows
- which state is persisted locally on disk versus derived from remote services
- how the desktop app coordinates terminals, chat panes, workspaces, and MCP
- where project metadata ends and workspace execution begins
- where the task model is stored and which clients consume it
- how feature metadata and generation tooling are distributed across packages
- how provider integrations are split across settings UI, API ingress, and shared routers
- how the feature stack is assembled as vertical slices rather than as one app
- how billing, org membership, and device presence are operated
- where analytics, telemetry, and observability are wired
- where auth and org identity are centralized versus still migrating
- how Electric sync and external integrations are wired
- how the full system is deployed across desktop, web, services, Workers, and hosted infrastructure

## Document template

Each subsystem document follows the same shape:

1. role
2. why it matters in the full system
3. runtime boundaries
4. libraries and services
5. real code locations
6. data or event flow
7. constraints and migration notes
