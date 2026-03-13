# Feature and Project Engine

## Role

This subsystem is the clearest expression of the repository's move from a
Superset fork toward a superbuilder system.

Its job is not only to render existing features. It also defines how features
are discovered, cataloged, scaffolded, composed, and exposed across apps.

## Why it matters

The long-term product direction is a combined toolchain that can move from code
and workspace context into reusable feature units, and from those feature units
into larger project surfaces.

This capability is spread across several packages and apps rather than being a
single monolithic engine.

## Main libraries and runtime pieces

- Drizzle-backed feature metadata
- NestJS feature modules
- Vite + React feature clients
- CLI scaffolding and registry utilities
- code scanning and registry generation helpers

## Key code locations

### Feature registry and extraction tooling

- `packages/atlas-engine/src/registry/`
- `packages/atlas-engine/src/extractor/`
- `packages/atlas-engine/src/resolver/`
- `packages/atlas-engine/src/cli.ts`

These files show that the engine does more than hold metadata. It scans,
parses, generates, and resolves feature structure from source trees.

### CLI scaffolding

- `packages/features-cli/src/commands/create.ts`
- `packages/features-cli/src/commands/add.ts`
- `packages/features-cli/src/commands/init.ts`
- `packages/features-cli/src/templates/feature/`
- `packages/features-cli/src/utils/registry.ts`

### Feature catalog backend

- `packages/features-server/features/feature-catalog/server/`
- `packages/features-server/features/feature-catalog/server/service/feature-catalog.service.ts`

This is the curated runtime catalog of published features and dependencies.

### Feature Studio data layer

Feature Studio (the feature creation and approval workflow) has been migrated
from `packages/features-server` to the superbuilder Neon DB:

- Schema: `packages/db/src/schema/feature-studio.ts`
- tRPC Router: `packages/trpc/src/router/feature-studio/`
- Desktop proxy: `apps/desktop/src/lib/trpc/routers/atlas/feature-studio.ts`

The desktop client accesses Feature Studio through `apps/api` at `/api/trpc`
using the `@superset/trpc` AppRouter.

### Feature server feature modules

- `packages/features-server/features/`

This directory is the practical feature inventory. It contains the actual server
modules that back feature-specific behavior. Note that Feature Studio has been
migrated out of this directory into `packages/db` and `packages/trpc`.

### Feature clients

- `apps/features-app/src/features/`
- `apps/feature-admin/src/features/`

These trees show how features are promoted into end-user and admin-facing
surfaces.

## Structural pattern

The engine is distributed across four layers:

1. source analysis and registry tooling
2. CLI scaffolding and feature creation commands
3. catalog and dependency metadata in the feature backend
4. concrete app surfaces that expose features to users and operators

This is why the repository feels like a system for composing capabilities rather
than only a normal multi-app product.

## Feature-to-project interpretation

Today the project-building story is still distributed:

- feature definitions and dependencies are modeled explicitly
- feature modules are materialized in server and client trees
- desktop workspaces and tasks provide execution context
- admin and app surfaces decide how those features are published and operated

So the system already contains strong feature-to-project building blocks, even
if not every part is consolidated under one explicit "project engine" service.

## Connected subsystems

- [Workspace and Code Context](./workspace-and-code-context.md)
- [Tasks System](./tasks-system.md)
- [Auth and Organization Model](./auth-and-organization-model.md)

## Constraints and migration notes

- the feature layer was inherited from Feature Atlas lineage and is still being
  adapted into the larger system
- some engine code still assumes older folder names and import conventions
- the practical engine is package-first; understanding `atlas-engine`,
  `features-cli`, `features-server`, and feature app trees matters more than
  looking for a single entrypoint
