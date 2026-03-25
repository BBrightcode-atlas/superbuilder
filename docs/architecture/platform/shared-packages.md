# Shared Packages

## Summary

The repository is package-first. Most apps are relatively thin and depend on
shared packages for contracts, UI, auth, and service behavior.

Today the shared layer is split into two package namespaces:

- `@superset/*` for the Superset-derived base layer
- `@superbuilder/*` for the newer superbuilder feature and project layer

This split is best read as an in-progress convergence pattern, not as a stable
forever boundary. The repository is moving toward a broader `superbuilder`
system built on top of the Superset fork foundation.

## Superset-derived foundation packages

### `@superset/auth`

Central auth package for the current platform foundation.

Responsibilities:

- Better Auth server configuration
- Better Auth React client
- OAuth provider support
- organization and membership flows
- API key and billing-related auth plugins

### `@superset/db`

Central database package for the current platform foundation.

Responsibilities:

- Drizzle schema
- client creation
- auth schema
- shared DB utilities
- Feature Studio schema (migrated from `@superbuilder/drizzle` as of 2026-03-13)

### `@superset/trpc`

Typed application API layer for the current platform foundation.

Responsibilities:

- root router composition
- context creation
- procedure helpers
- integration-oriented routers
- Feature Studio router (migrated from `@superbuilder/features-server` as of
  2026-03-13)

### `@superset/ui`

Primary shared UI library for the current platform foundation.

Responsibilities:

- reusable UI primitives
- shadcn-style components
- shared hooks and utilities
- cross-app styling helpers

### Other important packages

- `@superset/shared` for cross-app types, constants, auth helpers, command parsing
- `@superset/mcp` for MCP server and tool registration
- `@superset/desktop-mcp` for desktop-specific MCP exposure
- `@superset/local-db` for desktop-local persistence
- `@superset/workspace-service` for workspace orchestration service endpoints
- `@superset/chat` and `@superset/chat-mastra` for chat and Mastra integration
- `@superset/agent` for agent orchestration primitives
- `@superset/email` for email templates and email-related rendering

## Superbuilder atlas-engine package

### `@superbuilder/atlas-engine`

The active engine package for feature registry, dependency resolution, scaffold,
and pipeline orchestration.

Responsibilities:

- **manifest/** — `scanFeatureManifests()` (reads `feature.json` from
  `superbuilder-features`), `manifestsToRegistry()` (builds FeatureRegistry)
- **resolver/** — dependency resolution and topological sort
- **connection/** — `deriveConnections()` (provides → code snippets),
  `applyConnections()` (inserts into `[ATLAS:*]` markers)
- **transform/** — `transformImports()` (`@superbuilder/*` → `@repo/*`)
- **scaffold/** — boilerplate clone + feature copy + import transform + connection insert
- **pipeline/** — `composePipeline()` (scaffold + Neon + GitHub + Vercel + seed)

## Legacy superbuilder packages (삭제됨)

> **Legacy (삭제됨):** The following packages existed when feature code lived
> inside the `superbuilder` monorepo. They have been deleted as the platform
> migrated to the 3-repo model. Feature code now lives per-feature inside
> `superbuilder-features`.

### `@superbuilder/features-server` (삭제됨)

Was the exported contract surface for the feature and project backend layer
(feature modules, routers, shared server auth/logging/analytics/tRPC helpers).

**Current equivalent:** Feature server modules live in
`superbuilder-features/features/{name}/server/`. Platform-level tRPC routers
(e.g. Feature Studio) were migrated to `@superset/trpc` as of 2026-03-13.

### `@superbuilder/feature-ui` (삭제됨)

Was the shared UI layer for the feature and project layer (design system
components, layouts, editor and chat components).

**Current equivalent:** Each feature owns its own UI components inside
`superbuilder-features/features/{name}/`. Shared UI primitives use `@superset/ui`.

### `@superbuilder/drizzle` / `packages/features-db` (삭제됨)

Was the feature-layer DB schema and helpers.

**Current equivalent:** Per-feature DB schema lives in
`superbuilder-features/features/{name}/`. Platform schema (including Feature
Studio) was migrated to `@superset/db` as of 2026-03-13.

### `@superbuilder/widgets` (삭제됨)

Was reusable connected widgets (reactions, comments, notifications, etc.)
sitting between feature logic and host apps.

**Current equivalent:** Widget code lives per-feature in `superbuilder-features`.

### `@superbuilder/features-cli` (삭제됨)

Was CLI-based feature tooling (create, add, init commands, templates).

**Current equivalent:** CLI functionality is absorbed into
`@superbuilder/atlas-engine` (scaffold, pipeline) and the Desktop Atlas routers.

### `@superbuilder/features-client` (삭제됨)

Was shared client infrastructure (auth store, i18n, analytics, tRPC client
helpers) for the feature app layer.

**Current equivalent:** Feature client code lives per-feature in
`superbuilder-features`. Cross-cutting client concerns (auth, tRPC) use
`@superset/*` packages.

## Architectural consequence

The repository is not only app-centric. Its true architecture emerges from these
package layers.

In the current 3-repo model:

- `@superset/*` packages provide the base auth, DB, app, and tooling runtime
- `@superbuilder/atlas-engine` provides the feature-oriented composition,
  resolution, scaffold, and deployment pipeline
- feature code (server, client, DB, UI) lives in `superbuilder-features` and is
  discovered at runtime by `atlas-engine`
- the empty app template in `superbuilder-app-template` receives scaffolded
  feature code via `[ATLAS:*]` markers

Understanding the packages and the 3-repo split usually tells you more about
system boundaries than reading any single app.
