# Admin App

## Role

`apps/admin` is the internal admin and analytics interface for the main
Superset stack.

Its purpose is not feature editing or user-facing operations. It is a focused
dashboard-oriented application for operational visibility and administrative
workflows.

## Runtime and framework

- Next.js App Router
- React 19
- TanStack Query
- tRPC client integration
- Better Auth session model through shared packages
- PostHog and Sentry instrumentation

## Internal structure

The app is organized around a dashboard layout and a small set of management
screens.

Visible structure includes:

- `(dashboard)` shell and analytics components
- user management screens
- reusable dashboard widgets such as charts, leaderboard tables, and time filters

This suggests the app is optimized for internal operations and reporting rather
than broad user workflows.

## Dependencies

It relies on the same shared core as the main web product:

- `@superset/auth`
- `@superset/db`
- `@superset/trpc`
- `@superset/ui`
- `@superset/shared`

## Architectural role in the whole system

This app is the internal counterpart to `apps/web`.

- `apps/web` serves end users
- `apps/admin` serves internal operators
- `apps/api` supplies shared auth and API infrastructure to both

## Important distinction

This app is separate from `apps/feature-admin`, which belongs to the
`@superbuilder/*` feature subsystem.
