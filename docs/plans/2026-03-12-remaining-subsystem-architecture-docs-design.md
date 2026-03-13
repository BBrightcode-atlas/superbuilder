# Remaining Subsystem Architecture Docs Design

## Goal

Extend the architecture set with a fourth batch that documents the remaining
high-value internal maps:

- project and workspace operations
- integration provider surfaces
- deployment and runtime topology
- feature vertical structure

## Why this batch matters

The current architecture set already explains:

- app roles
- shared platform layers
- developer execution systems
- product operations systems

What is still missing is the connective tissue that helps a new engineer answer
questions such as:

- where projects are remote records versus local desktop records
- how repo import, worktree creation, and workspace initialization are split
- where GitHub, Linear, and Slack integrations live across web and API
- how the system is actually deployed across desktop, Vercel, Fly, and
  Cloudflare
- how feature-stack verticals are distributed across app, admin, server,
  schema, widgets, and generation tooling

## Recommended document set

Add these subsystem documents:

- `docs/architecture/subsystems/project-and-workspace-operations.md`
- `docs/architecture/subsystems/integration-provider-surfaces.md`
- `docs/architecture/subsystems/deployment-and-runtime-topology.md`
- `docs/architecture/subsystems/feature-vertical-map.md`

Update:

- `docs/architecture/README.md`
- `docs/architecture/subsystems/README.md`

## Document scope

### Project and workspace operations

Cover:

- org-scoped project/workspace metadata in `packages/trpc/src/router`
- desktop-local project/workspace lifecycle in `apps/desktop/src/lib/trpc`
- local SQLite records in `@superset/local-db`
- worktree creation, init progress, and workspace runtime/service layers

### Integration provider surfaces

Cover:

- web integration settings pages
- API OAuth callbacks and webhook handlers
- provider-specific routers in `packages/trpc/src/router/integration`
- external services: GitHub, Linear, Slack, QStash

### Deployment and runtime topology

Cover:

- root Bun + Turbo orchestration
- Next.js web/api surfaces
- desktop Electron packaging
- feature-stack Nest/Hono services
- Electric deployment split across Fly and Cloudflare
- Vercel deployment manifests where they exist

### Feature vertical map

Cover:

- `apps/features-app`
- `apps/feature-admin`
- `packages/features-server/features`
- `packages/drizzle/src/schema/features`
- `packages/features-client`
- `packages/widgets`
- `packages/atlas-engine`
- `packages/features-cli`

## Writing constraints

- stay architecture-first and code-light
- include real file paths and relevant libraries
- explain how the Superset-derived base and newer superbuilder feature stack
  meet in these subsystems
- prefer structural and operational explanations over API detail
