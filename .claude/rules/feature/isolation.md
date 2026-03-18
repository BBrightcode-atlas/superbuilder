---
description: Feature isolation rules for safe feature implementation.
globs: "apps/features-app/src/features/**/*,apps/feature-admin/src/features/**/*,packages/features-server/features/**/*,packages/widgets/src/**/*,packages/drizzle/src/schema/features/**/*"
alwaysApply: false
---

# Feature Isolation

When implementing a feature, keep the change isolated to that feature plus the
minimum required registration files.

## Allowed edits

- the active feature folder in `apps/features-app/src/features/{name}/`
- the active feature folder in `apps/feature-admin/src/features/{name}/`
- the active feature folder in `packages/features-server/features/{name}/`
- the active widget folder in `packages/widgets/src/{name}/`
- the active schema folder in `packages/drizzle/src/schema/features/{name}/`
- shared registration files listed in `dependencies.md`

## Disallowed edits

- changing another feature's routes, hooks, pages, services, or schema
- adding behavior to an unrelated feature just to make the new feature work
- moving shared business logic into another feature instead of a shared package

## Principle

Reference other features through their public contracts. Do not open up unrelated
feature internals as a shortcut.

## Safe pattern

If a new feature needs:

- shared database primitives: use or extend shared core schema deliberately
- shared UI: use `@superbuilder/feature-ui` or `packages/widgets`
- shared infrastructure: use `@superbuilder/features-client/*` or
  `@superbuilder/features-server/core/*`

If you think another feature must be edited, stop and check whether the real need
is a shared package, a public export, or a registration change.
