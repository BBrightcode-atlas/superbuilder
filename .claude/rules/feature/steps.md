---
description: Implementation order and registration checklist for feature work.
globs: "apps/features-app/src/features/**/*,apps/feature-admin/src/features/**/*,packages/features-server/features/**/*,packages/widgets/src/**/*,packages/drizzle/src/schema/features/**/*"
alwaysApply: false
---

# Feature Implementation Steps

Use this checklist when creating a new feature or doing structural feature work.

## Phase 1: Classify the feature

Decide whether the feature is:

- a page feature with routes
- a widget feature embedded elsewhere
- an agent feature that also needs `apps/agent-server/src`

Then create only the folders that match that type.

If the feature needs login state, session awareness, organization membership, or
admin authorization, read `auth.md` before creating implementation files.

## Phase 2: Build the feature internals

### Schema

Create or update:

- `packages/drizzle/src/schema/features/{name}/index.ts`

### Server

Create or update:

- `packages/features-server/features/{name}/index.ts`
- `packages/features-server/features/{name}/{name}.module.ts`
- `packages/features-server/features/{name}/trpc/*`
- `packages/features-server/features/{name}/service/*` or `services/*`
- `packages/features-server/features/{name}/controller/*`
- `packages/features-server/features/{name}/types/*`
- `packages/features-server/features/{name}/dto/*` when input types need DTOs

If the server side is auth-aware, keep request authentication in shared auth
guards and shared tRPC procedures instead of feature-local token handling.

### Client page feature

Create or update:

- `apps/features-app/src/features/{name}/index.ts`
- `apps/features-app/src/features/{name}/routes/*`
- `apps/features-app/src/features/{name}/pages/*`
- `apps/features-app/src/features/{name}/components/*`
- `apps/features-app/src/features/{name}/hooks/*`
- `apps/features-app/src/features/{name}/types/*`

### Admin feature

If the feature has an admin surface, create or update:

- `apps/feature-admin/src/features/{name}/index.ts`
- `apps/feature-admin/src/features/{name}/routes/*`
- `apps/feature-admin/src/features/{name}/pages/*`
- `apps/feature-admin/src/features/{name}/components/*`
- `apps/feature-admin/src/features/{name}/hooks/*`

### Widget feature

If the feature is embedded, create or update:

- `packages/widgets/src/{name}/index.ts`
- `packages/widgets/src/{name}/*`

## Phase 3: Register the feature

Update the minimum required shared files.

### Always update when adding a new server-backed feature

- `packages/drizzle/src/schema/index.ts`
- `packages/features-server/package.json`
- `packages/features-server/app-router.ts`
- `apps/features-server/src/trpc/router.ts`
- `apps/features-server/src/app.module.ts`

If auth migration is part of the change, additional shared files may be part of
scope:

- `packages/features-client/core/auth/*`
- `packages/features-server/core/nestjs/auth/*`
- `packages/drizzle/src/schema/core/auth.ts`

### Update when the feature has user routes

- `apps/features-app/src/router.tsx`

### Update when the feature has admin routes

- `apps/feature-admin/src/router.tsx`
- `apps/feature-admin/src/feature-config.ts` when it should appear in the admin sidebar

### Update when the feature is a widget

- `packages/widgets/package.json`

## Phase 4: Verify

At minimum, verify:

- the feature is exported from its local `index.ts`
- shared entry points reference the new feature consistently
- paths use current repository locations, not old Atlas defaults
- auth-aware feature code uses shared auth entry points instead of custom token
  parsing or fresh legacy role-table joins

Recommended repo checks:

- `bun run typecheck`
- `bun run lint`

If the work changes runtime behavior, also run the most relevant focused tests or
manual app checks for the touched feature.
