# Data and Auth

## Data layer summary

The repository uses two main database/schema centers:

- `@superset/db` for the Superset-derived foundation
- `@superbuilder/drizzle` for the newer feature and project layer

Both use Drizzle ORM, but they belong to different application families and are
not yet fully unified.

## Superset-derived foundation data model

The Superset-derived base uses:

- Neon / Postgres
- Drizzle schema in `packages/db`
- Better Auth-compatible auth schema
- tRPC and route handlers layered on top of the DB package

This layer already treats auth, sessions, organizations, members, invitations,
subscriptions, and API keys as centralized platform concepts.

As of 2026-03-13, Feature Studio schema and tRPC router have been migrated into
this layer (`packages/db/src/schema/feature-studio.ts` and
`packages/trpc/src/router/feature-studio/`), consolidating feature creation
workflow data alongside the platform foundation.

## Feature and project layer data model

The newer superbuilder layer uses:

- `@superbuilder/drizzle`
- schema folders split into `core` and `features`
- feature-local tables under `packages/drizzle/src/schema/features/*`
- feature service logic in `packages/features-server/features/*`

This stack currently still reflects a transition state. It has centralized auth
and feature tables, but some code still carries Supabase-oriented assumptions.

Note: Feature Studio has been migrated out of this layer into the
Superset-derived foundation (`packages/db` + `packages/trpc`). Other feature
modules remain in `packages/features-server`.

## Auth model: Superset-derived foundation

The `@superset/*` foundation is already built around Better Auth.

Key characteristics:

- Better Auth server configuration lives in `packages/auth`
- the auth layer is shared by web, admin, desktop, mobile, and API routes
- orgs and memberships are first-class
- JWT, API key, billing, OAuth provider, and custom session behavior are all
  composed inside the auth package

This gives the current platform foundation a strong central identity model.

## Auth model: feature and project layer

The `@superbuilder/*` feature layer is mid-migration.

Observed characteristics:

- client auth state is centralized in `packages/features-client/core/auth`
- server auth guards are centralized in `packages/features-server/core/nestjs/auth`
- `apps/features-server` creates request user context from auth headers
- `apps/features-app` and `apps/feature-admin` still use Supabase-style client setup
- repository planning docs point toward a Better Auth migration for this stack

The important architectural point is that this layer already has auth
centralization, but its identity model is not fully converged yet.

## Sync and live data

The presence of Electric SQL components and a dedicated `apps/electric-proxy`
shows that this repository supports live or synced data flows in at least some
clients.

That flow appears to be:

1. client requests sync through Electric-compatible endpoints
2. proxy validates bearer token and organization scope
3. proxy forwards filtered requests upstream

This adds a live-data layer on top of ordinary request/response APIs.

## Practical mental model

Use this split when reasoning about data and auth:

- `@superset/*`: the current Better Auth and DB foundation
- `@superbuilder/*`: the newer feature-local and project-local data layer moving
  toward the same direction

This explains why similar concepts such as sessions, memberships, and user state
can appear twice in the repository with different maturity levels.
