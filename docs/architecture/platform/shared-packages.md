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

## Superbuilder feature and project packages

### `@superbuilder/features-server`

This is the exported contract surface for the feature and project backend layer.

Responsibilities:

- feature modules and routers
- shared server auth, logging, analytics, and tRPC helpers
- feature-level type exports

### `@superbuilder/features-client`

Shared client infrastructure for the feature and project layer.

Responsibilities:

- auth store and guards
- i18n and theme
- analytics and error wrappers
- tRPC client helpers

### `@superbuilder/feature-ui`

Shared UI layer for the feature and project layer.

Responsibilities:

- design system components
- layouts
- editor and chat components
- mobile-oriented UI primitives inside the feature stack

### `@superbuilder/widgets`

Reusable connected widgets that sit between feature logic and host apps.

Responsibilities:

- embedded feature UI such as reactions, comments, notifications, onboarding,
  file-manager pieces, and bookmarks

### Additional feature-platform packages

- `@superbuilder/drizzle` for the feature-layer DB schema and helpers
- `@superbuilder/atlas-engine` for feature registry, extraction, and generation support
- `@superbuilder/features-cli` for CLI-based feature tooling

## Architectural consequence

The repository is not only app-centric. Its true architecture emerges from these
package layers.

Those layers are what make the combined workflow possible:

- Superset-derived packages provide the base auth, DB, app, and tooling runtime
- superbuilder packages provide the feature-oriented composition and generation
  layer
- together they support a system that can move from code context to feature
  definition to project construction

Understanding the packages usually tells you more about system boundaries than
reading any single app.
