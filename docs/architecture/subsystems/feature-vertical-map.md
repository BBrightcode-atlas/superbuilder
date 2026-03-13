# Feature Vertical Map

## Role

This document explains how the superbuilder feature stack is arranged as
vertical slices.

A feature is not stored in one place. It is usually spread across:

- client routes in `apps/features-app`
- admin routes in `apps/feature-admin`
- server modules in `packages/features-server/features`
- schema in `packages/drizzle/src/schema/features`
- optional widgets in `packages/widgets`
- shared client infrastructure in `packages/features-client`
- generation and extraction tooling in `packages/atlas-engine` and
  `packages/features-cli`

## Why it matters

This is the main structural layer that turns the repository from a generic
Superset fork into a combined system for creating and operating features.

If you want to understand how a capability is added, enabled, extracted,
trimmed, or mapped into a project template, this vertical structure is the key.

## Main libraries and runtime pieces

- TanStack Router for feature-app and feature-admin route composition
- React and Vite for feature-app UI
- NestJS + tRPC for the shared feature backend
- Drizzle ORM for feature-level schema
- PostHog and shared client core packages for analytics and auth
- CLI tooling through `commander`, `inquirer`, `chalk`, `ora`, and `fs-extra`

## Key code locations

### Client route composition

- `apps/features-app/src/router.tsx`
- `apps/features-app/src/pages/index.ts`
- `apps/features-app/src/features/`
- `apps/feature-admin/src/router.tsx`
- `apps/feature-admin/src/pages/index.ts`
- `apps/feature-admin/src/features/`

These routers assemble the vertical slices into actual product surfaces.

Representative feature route groupings include:

- `apps/features-app/src/features/agent-desk/routes/`
- `apps/features-app/src/features/task/routes/`
- `apps/features-app/src/features/marketing/routes/`
- `apps/features-app/src/features/ai-image/routes/`
- `apps/feature-admin/src/features/analytics/routes.tsx`
- `apps/feature-admin/src/features/community/routes/`
- `apps/feature-admin/src/features/email/routes.ts`

### Feature backend

- `packages/features-server/features/`

Each feature commonly has some combination of:

- `*.module.ts`
- `service/`
- `controller/`
- `trpc/`
- `dto/`
- `types/`

Representative verticals that show the pattern well:

- `packages/features-server/features/agent-desk/`
- `packages/features-server/features/task/`
- `packages/features-server/features/content-studio/`
- `packages/features-server/features/marketing/`
- `packages/features-server/features/community/`
- `packages/features-server/features/feature-catalog/`

### Feature data model

- `packages/drizzle/src/schema/features/`

This schema layer is where feature persistence is declared. It mirrors the
server feature layout rather than the legacy Superset package layout.

Representative schema folders include:

- `packages/drizzle/src/schema/features/task/`
- `packages/drizzle/src/schema/features/content-studio/`
- `packages/drizzle/src/schema/features/marketing/`
- `packages/drizzle/src/schema/features/agent-desk/`
- `packages/drizzle/src/schema/features/analytics/`

### Shared feature-client core

- `packages/features-client/core/auth/`
- `packages/features-client/core/analytics/`
- `packages/features-client/core/i18n/`
- `packages/features-client/core/theme/`
- `packages/features-client/shared/components/`
- `packages/features-client/shared/hooks/`
- `packages/features-client/trpc-client.ts`

This package provides the reusable client substrate used across feature
verticals:

- auth guards and auth store
- analytics providers
- i18n helpers
- theme and UI helpers
- shared hooks and shared components

### Widgets

- `packages/widgets/src/`

Widgets are reusable feature-facing UI units that can be included without
bringing an entire page vertical.

Representative widget areas include:

- `packages/widgets/src/comment/`
- `packages/widgets/src/reaction/`
- `packages/widgets/src/review/`
- `packages/widgets/src/notification/`
- `packages/widgets/src/file-manager/`
- `packages/widgets/src/onboarding/`

### Generation and extraction tooling

- `packages/atlas-engine/src/registry/scanner.ts`
- `packages/atlas-engine/src/resolver/`
- `packages/atlas-engine/src/extractor/extractor.ts`
- `packages/atlas-engine/src/extractor/generators/`
- `packages/features-cli/src/commands/`
- `packages/features-cli/src/templates/feature/`

This tooling layer turns feature verticals into something operable:

- scanning feature directories and schema folders
- grouping features by type and domain
- resolving dependency sets
- extracting a reduced project from a larger feature source tree
- scaffolding and managing features through CLI commands

## Vertical examples

### Agent Desk

This vertical is one of the clearest combined-tool examples.

- app routes: `apps/features-app/src/features/agent-desk/`
- server logic: `packages/features-server/features/agent-desk/`
- schema: `packages/drizzle/src/schema/features/agent-desk/`

It spans designer flows, chat flows, execution, file analysis, and publishing.

### Task

This is the most direct operations vertical.

- app routes: `apps/features-app/src/features/task/`
- server logic: `packages/features-server/features/task/`
- schema: `packages/drizzle/src/schema/features/task/`

It is deeply connected to execution handoff and project workflow.

### Content Studio and Marketing

These show how adjacent verticals can stay separate but collaborate.

- content authoring and SEO live in
  `apps/features-app/src/features/content-studio/` and
  `packages/features-server/features/content-studio/`
- publishing and campaign orchestration live in
  `apps/features-app/src/features/marketing/` and
  `packages/features-server/features/marketing/`

### Community and analytics-admin style verticals

These show the role split between feature-app and feature-admin.

- public or end-user flows can live in the app client
- moderation, admin, and reporting surfaces can live in the admin client
- the server and schema layers stay shared across both

## Connected subsystems

- [Feature and Project Engine](./feature-and-project-engine.md)
- [Tasks System](./tasks-system.md)
- [Auth and Organization Model](./auth-and-organization-model.md)
- [Deployment and Runtime Topology](./deployment-and-runtime-topology.md)

## Current constraints

- some verticals still show migration seams, especially around auth assumptions
  and older package naming
- feature presence is not always symmetrical across app, admin, widget, and
  schema layers
- the atlas-engine and CLI still carry source-project assumptions from the
  earlier Feature Atlas lineage, even though they are now being used to support
  superbuilder extraction and generation flows
