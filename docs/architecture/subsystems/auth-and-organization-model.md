# Auth and Organization Model

## Role

This subsystem defines identity, session, organization, and membership
boundaries across the repository.

It is one of the most important architectural seams because the repository is
currently converging from older Superset and feature-stack assumptions toward a
shared superbuilder direction.

## Why it matters

Almost every other subsystem depends on it:

- desktop and web need session and org context
- Electric sync needs org-scoped JWT claims
- task and feature APIs need authenticated users
- integrations and API keys rely on the same identity model

## Main libraries and services

- Better Auth
- Drizzle ORM
- Neon / Postgres
- JWT / JWKS validation
- organization and membership plugins
- OAuth provider support

## Key code locations

### Superset-derived foundation

- `packages/auth/src/server.ts`
- `packages/db/src/schema/auth.ts`
- `packages/shared/src/auth/`
- `packages/trpc/src/root.ts`

This is the strongest current center of auth consolidation. It already models:

- users
- sessions
- organizations
- members
- invitations
- OAuth clients and tokens
- API keys

### Feature-layer auth state

- `packages/features-client/core/auth/`
- `packages/features-server/core/nestjs/auth/`
- `packages/features-server/core/trpc/trpc.ts`
- `docs/superpowers/specs/2026-03-12-features-server-auth-better-auth-design.md`

These locations show the current split:

- feature clients still expose Supabase-oriented auth stores and guards
- feature server still uses JWT header parsing and local auth procedures
- the repository already has a written migration path toward Better Auth-style
  convergence in the feature layer

## Identity model

### Foundation model

The Superset-derived foundation already uses Better Auth as the source of truth.
Organizations and memberships are first-class, and session payloads are used
across web, desktop, mobile, and sync boundaries.

### Feature-layer model

The feature layer has central auth touchpoints, but not full convergence yet.
It still carries older assumptions around Supabase client state, profile-based
references, and local role/procedure handling.

## Org flow significance

Organization membership is not just billing or admin metadata here. It is a
runtime partition used by:

- sync access
- API authorization
- task and workspace ownership
- integration scoping

That is why auth and organization modeling belong in the architecture docs, not
only in auth package docs.

## Constraints and migration notes

- the feature stack is still in auth transition
- similar concepts can exist twice, once in the Better Auth-centered foundation
  and once in older feature-layer structures
- the intended direction is not permanent duplication; it is eventual
  convergence into a broader superbuilder identity model
