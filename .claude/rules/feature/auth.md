---
description: Auth guardrails for feature implementation during the Better Auth migration.
globs: "apps/features-app/src/features/**/*,apps/feature-admin/src/features/**/*,packages/features-server/features/**/*,packages/widgets/src/**/*,packages/features-client/core/auth/**/*,packages/features-server/core/nestjs/auth/**/*,packages/drizzle/src/schema/core/auth.ts"
alwaysApply: false
---

# Feature Auth Rules

## Status

Auth is in an active migration from Supabase-centered patterns to Better Auth.
Feature work must avoid deepening old auth assumptions even if compatibility
layers still exist in the current branch.

Target design reference:

- `docs/superpowers/specs/2026-03-12-features-server-auth-better-auth-design.md`

## Source of truth

### Client

For feature UI code, use shared auth state from:

- `@superbuilder/features-client/core/auth`

Allowed examples:

- `authenticatedAtom`
- `sessionAtom`
- `currentSessionAtom`
- `profileAtom`
- `AuthGuard`
- `AdminGuard`

Do not create feature-local auth stores or custom token plumbing.

### Server

For feature server code, use shared auth gates from:

- `packages/features-server/core/nestjs/auth/*`
- `packages/features-server/core/trpc/*`

Allowed examples:

- `JwtAuthGuard`
- `NestAdminGuard`
- `CurrentUser`
- `authProcedure`
- `adminProcedure`
- `getAuthUserId`

Do not parse bearer tokens or reimplement role checks inside feature modules.

### Database

Auth and identity tables are centralized in core schema, not feature schema.

- current compatibility path: `packages/drizzle/src/schema/core/auth.ts`
- migration target from the spec: Better Auth-compatible core auth tables

Do not create feature-local auth tables or duplicate auth/session membership data
inside a feature schema.

## Migration-safe rules

### New feature code must target the Better Auth model

When writing new auth-aware feature code, think in terms of:

- `users`
- `sessions`
- `organizations`
- `members`
- `invitations`
- `accounts`
- `verifications`

Even if the branch still exposes legacy compatibility layers, new feature logic
should be easy to move to that model.

### Avoid new Supabase-specific assumptions

Do not introduce fresh feature code that depends on:

- Supabase-only JWT claim shapes
- `auth.users`-specific SQL in feature logic
- direct `supabaseAtom` usage in ordinary feature UI
- custom bearer token parsing inside feature routes or services

Existing migration work may still touch those areas, but new feature code should
not spread them further.

### Do not treat profiles as auth identity

`profiles` may still exist for display metadata, but feature auth identity should
come from the authenticated user/session contract.

Rules:

- use `ctx.user.id` or `CurrentUser().id` for authenticated ownership checks
- use `profile` data only for display and enrichment
- do not make `profiles` the source of truth for login, session, or role state

### Do not add new `roles` or `userRoles` dependencies

The spec moves authorization toward organization membership roles.

Rules:

- do not add new joins to `roles` or `userRoles` in feature code
- do not add new feature logic that depends on role slugs stored in those tables
- use shared admin guards and procedures instead of rechecking role tables

If a migration task must touch those tables for compatibility, isolate that work
to the auth/core migration layer rather than general feature code.

## Implementation guidance

### Client feature code

- Gate authenticated UI with shared guards and shared auth atoms.
- Prefer session-derived identity over duplicated local user state.
- Keep auth adapters centralized in `packages/features-client/core/auth`.

### Server feature code

- Controllers: use `JwtAuthGuard`, `NestAdminGuard`, and `CurrentUser`.
- tRPC: use `authProcedure` and `adminProcedure`.
- Services: accept `userId` or organization context as input; do not read request
  auth state directly.

### Admin authorization

During migration, admin access rules may change internally. Feature code should
depend only on:

- `NestAdminGuard` for NestJS routes
- `adminProcedure` for tRPC

Do not hardcode admin role names inside feature modules unless the auth/core
migration explicitly requires it.

## Schema guidance for feature authors

If a feature stores ownership or membership references:

- follow the active core auth contract in `packages/drizzle/src/schema/core/auth.ts`
- prefer a centralized auth user identifier over ad hoc profile coupling
- keep the choice localized so later FK changes stay contained

If the branch has not landed the Better Auth schema yet, use the smallest
possible compatibility layer and document the temporary choice in the feature
change.
