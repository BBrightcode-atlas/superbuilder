# API App

## Role

`apps/api` is the main HTTP service surface for the Superset-derived foundation.

It is not a traditional standalone backend service in its own framework. It is a
Next.js application used primarily as an API and integration host. It handles
auth endpoints, tRPC transport, agent endpoints, sync proxying, and multiple
third-party integration callbacks and webhooks.

## Runtime and framework

- Next.js App Router route handlers
- Better Auth server integration
- tRPC server transport
- Drizzle-backed data access via shared packages
- background-facing integration logic for GitHub, Linear, Slack, Stripe, and chat

## Main route families

### Auth and identity

- `api/auth/[...all]`
- OAuth and OIDC discovery under `.well-known/*`
- desktop auth connection flows

This makes the app the public auth authority for the current shared foundation.

### Typed application API

- `api/trpc/[trpc]`

This is the main typed procedure entry point for web and likely other clients in
the `@superset/*` stack. As of 2026-03-13, it also serves the Feature Studio
tRPC router (`featureStudio` namespace), which was migrated from
`apps/features-server`.

### Chat and agent endpoints

- `api/chat/*`
- `api/agent/[transport]`

These routes host higher-level agent and streaming functionality that sits above
the lower-level shared agent packages.

### Integrations

- GitHub callback, install, sync, jobs, webhook
- Slack connect, callback, events, interactions, jobs, linking
- Linear connect, callback, jobs, webhook
- Stripe jobs

This makes the API app a major integration hub, not just a data API.

### Sync and proxying

- `api/electric/[...path]`
- proxy routes such as Linear image proxying

## Dependencies

The app coordinates many shared packages:

- `@superset/auth`
- `@superset/db`
- `@superset/trpc`
- `@superset/mcp`
- `@superset/shared`

It also integrates with operational services such as Upstash, Stripe, GitHub,
Slack, Linear, and Vercel Blob.

## Architectural role in the whole system

This app is the operational backbone of the browser product stack.

If `apps/web` is the primary user UI, `apps/api` is the main service gateway for:

- authentication
- typed RPC
- integrations
- background jobs and callbacks
- agent-related API endpoints

## Important distinction

This app is separate from `apps/features-server`, which serves the newer feature
and project layer.

The repository therefore still has two backend centers of gravity, but that
split should be read as an evolution stage inside one larger system. Feature
Studio is one example of this convergence: its data layer has been migrated from
`features-server` into `packages/db` and `packages/trpc`, and is now served
through this app.
