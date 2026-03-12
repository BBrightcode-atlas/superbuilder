# Web App

## Role

`apps/web` is the primary authenticated browser product for the main Superset
stack. It is where end users manage tasks, integrations, billing-related flows,
OAuth consent, and invitation acceptance.

## Runtime and framework

- Next.js App Router
- React 19
- TanStack Query
- tRPC client bindings
- Better Auth client integration through shared packages
- PostHog and Sentry instrumentation

## Internal structure

The app is organized around route groups rather than a separate SPA router.

Key route areas:

- `(auth)` for sign-in and sign-up
- `(dashboard)` for the main authenticated application shell
- `tasks/[slug]` for task detail screens
- `integrations/*` for GitHub, Linear, and Slack setup surfaces
- `oauth/consent` for OAuth provider authorization flows
- `accept-invitation/[invitationId]` for organization onboarding
- `auth/desktop/success` for desktop-linked auth flows

## Dependencies

The app depends heavily on shared platform packages:

- `@superset/auth`
- `@superset/db`
- `@superset/trpc`
- `@superset/ui`
- `@superset/shared`

This means most business logic and data shape definitions live outside the app
itself. The app mainly composes pages, data fetching, and product UX.

## Architectural role in the whole system

This is the browser front-end counterpart to `apps/api`.

- `apps/web` renders the user-facing UI
- `apps/api` provides auth, tRPC, integrations, and service endpoints
- shared packages define data contracts, auth behavior, and typed APIs

## What it is not

It is not the marketing site, not the admin analytics site, and not the
feature-platform client. Those responsibilities are split across
`apps/marketing`, `apps/admin`, and `apps/features-app`.
