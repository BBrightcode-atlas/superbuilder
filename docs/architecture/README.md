# Architecture Guide

This folder is a reverse-engineered map of the repository.

It is written for someone who needs to understand how the system is put together
before changing it. The emphasis is on roles, boundaries, runtime shape,
libraries, services, and package relationships rather than line-by-line code.

The intended framing is not "two permanent products living side by side." A
better mental model is:

- this repository was forked from Superset
- the legacy `@superset/*` namespace still powers large parts of the system
- the long-term direction is convergence toward `superbuilder`
- the end product is a combined toolchain for turning code into features and
  features into projects inside one system

## Recommended reading order

1. [Overview](./overview.md)
2. App documents in [`apps/`](./apps/)
3. Subsystem documents in [`subsystems/`](./subsystems/)
4. Platform documents in [`platform/`](./platform/)

## What these docs are trying to clarify

- which apps still reflect the Superset fork lineage
- which apps form the feature and project creation workflow
- how legacy `@superset/*` packages and newer `@superbuilder/*` packages fit together
- where auth, data, agents, MCP, and sync responsibilities live
- how the monorepo is built and run

## Document map

### System

- [Overview](./overview.md)

### Apps

- [Web](./apps/web.md)
- [API](./apps/api.md)
- [Admin](./apps/admin.md)
- [Marketing](./apps/marketing.md)
- [Docs Site](./apps/docs-site.md)
- [Desktop](./apps/desktop.md)
- [Mobile](./apps/mobile.md)
- [Features App](./apps/features-app.md)
- [Features Landing](./apps/features-landing.md)
- [Feature Admin](./apps/feature-admin.md)
- [Features Server](./apps/features-server.md)
- [Agent Server](./apps/agent-server.md)
- [Electric Proxy](./apps/electric-proxy.md)
- [Streams](./apps/streams.md)
- [Workers](./apps/workers.md)

### Subsystems

- [Subsystem Guide](./subsystems/README.md)
- [Desktop Agent Runtime](./subsystems/desktop-agent-runtime.md)
- [CLI Agent Launchers](./subsystems/cli-agent-launchers.md)
- [Chat and Agent Conversation Runtime](./subsystems/chat-and-agent-conversation-runtime.md)
- [MCP Tooling Surfaces](./subsystems/mcp-tooling-surfaces.md)
- [Terminal and Session Infrastructure](./subsystems/terminal-and-session-infrastructure.md)
- [Local State and Persistence](./subsystems/local-state-and-persistence.md)
- [Workspace and Code Context](./subsystems/workspace-and-code-context.md)
- [Project and Workspace Operations](./subsystems/project-and-workspace-operations.md)
- [Tasks System](./subsystems/tasks-system.md)
- [Feature and Project Engine](./subsystems/feature-and-project-engine.md)
- [Feature Vertical Map](./subsystems/feature-vertical-map.md)
- [Integration Provider Surfaces](./subsystems/integration-provider-surfaces.md)
- [Billing and Subscription Operations](./subsystems/billing-and-subscription-operations.md)
- [Organization and Member Operations](./subsystems/organization-and-member-operations.md)
- [Device and Presence Operations](./subsystems/device-and-presence-operations.md)
- [Analytics and Observability](./subsystems/analytics-and-observability.md)
- [Auth and Organization Model](./subsystems/auth-and-organization-model.md)
- [Sync and Integrations](./subsystems/sync-and-integrations.md)
- [Deployment and Runtime Topology](./subsystems/deployment-and-runtime-topology.md)

### Platform

- [Shared Packages](./platform/shared-packages.md)
- [Data and Auth](./platform/data-and-auth.md)
- [Agent and MCP](./platform/agent-and-mcp.md)
- [Build and Runtime](./platform/build-and-runtime.md)
