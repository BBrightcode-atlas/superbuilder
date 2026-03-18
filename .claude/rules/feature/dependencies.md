---
description: Import, export, and cross-feature dependency rules for feature work.
globs: "apps/features-app/src/features/**/*,apps/feature-admin/src/features/**/*,packages/features-server/features/**/*,packages/widgets/src/**/*"
alwaysApply: false
---

# Feature Dependencies

## Public import rules

### Client feature code

Allowed import sources:

- local feature files via relative paths
- `@superbuilder/features-client/*` for shared client auth, i18n, logging, and helpers
- `@superbuilder/features-server/{name}` or `@superbuilder/features-server/{name}/types`
  for public server types only
- `@superbuilder/feature-ui/*` for shared UI
- `@superbuilder/widgets/{name}` for reusable connected widgets

### Server feature code

Allowed import sources:

- local feature files via relative paths
- `@superbuilder/drizzle` for schema and database bindings
- `@superbuilder/features-server/core/*` for shared server infrastructure
- another feature's public entry point only when read-only integration is required

If auth or session behavior is involved, also follow `auth.md`.

## Banned imports

- deep-importing another feature's internal files
- importing client feature files from server code
- importing server implementation files into client feature code
- cross-feature relative paths such as `../../other-feature/...`
- new feature-level auth wiring that bypasses shared `core/auth` or shared auth guards
- new feature-level role checks against legacy `roles` or `userRoles` tables

Examples:

```ts
// Good
import { boardRouter } from "@superbuilder/features-server/board";
import type { BoardWithStats } from "@superbuilder/features-server/board/types";

// Bad
import { BoardService } from "../../board/service/board.service";
import { SomePage } from "../../../features/board/pages/some-page";
```

## Export rules

- Every feature owns its public surface in its local `index.ts`.
- Export only what outside callers should use.
- Keep implementation-only helpers, local constants, and internal hooks private.

## Shared file exceptions

Cross-feature edits are allowed only in shared registration files such as:

- `packages/drizzle/src/schema/index.ts`
- `packages/features-server/package.json`
- `packages/widgets/package.json`
- `packages/features-server/app-router.ts`
- `apps/features-server/src/trpc/router.ts`
- `apps/features-server/src/app.module.ts`
- `apps/features-app/src/router.tsx`
- `apps/feature-admin/src/router.tsx`
- `apps/feature-admin/src/feature-config.ts`

Auth migration exceptions may also touch these shared paths:

- `packages/features-client/core/auth/*`
- `packages/features-server/core/nestjs/auth/*`
- `packages/drizzle/src/schema/core/auth.ts`

If an edit falls outside the active feature folder and outside this list, treat it
as suspicious and justify it explicitly.
