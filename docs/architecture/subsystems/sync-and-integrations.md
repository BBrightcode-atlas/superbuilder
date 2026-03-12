# Sync and Integrations

## Role

This subsystem connects the internal product model to external systems and live
data flows.

It includes webhook and OAuth integration surfaces, background sync routes, and
an Electric-aware proxy layer for authorized live data access.

## Why it matters

The repository is not closed around its own database. It relies on external
systems for collaboration, billing, notifications, identity extensions, and
operational sync.

Without this layer, much of the multi-app and multi-agent story would be cut off
from the user's actual tools and organizations.

## Main libraries and services

- Next.js route handlers in `apps/api`
- Better Auth JWT + JWKS validation
- Electric SQL proxying
- Slack, Linear, GitHub, and Stripe integrations
- Cloudflare Worker runtime in the Electric proxy

## Key code locations

### Electric sync boundary

- `apps/electric-proxy/src/index.ts`
- `apps/electric-proxy/src/auth.ts`
- `apps/electric-proxy/src/electric.ts`
- `apps/electric-proxy/src/where.ts`

This service validates JWTs, checks organization membership, constrains table
queries, and forwards approved shape requests upstream to Electric.

### Integration host

- `apps/api/src/app/api/integrations/linear/`
- `apps/api/src/app/api/integrations/slack/`
- `apps/api/src/app/api/integrations/stripe/`

These route trees show that `apps/api` is an integration host as much as it is a
typed API surface.

### Shared typed API layer

- `packages/trpc/src/root.ts`

The root router demonstrates that integrations live beside organization,
workspace, agent, project, and task APIs rather than outside them.

## Flow

There are two main patterns.

### Live sync path

1. a client sends an Electric-compatible request with bearer auth
2. the Electric proxy verifies the JWT against the auth server JWKS endpoint
3. the proxy checks organization scope and rewrites the allowed table filter
4. the request is forwarded to Electric Cloud with constrained query params

### Integration path

1. an external service hits a callback, webhook, or job route in `apps/api`
2. the API layer validates origin, tokens, or signatures
3. shared auth, DB, and tRPC layers are used to connect that event to internal
   organization, user, task, or workspace state

## Connected subsystems

- [Auth and Organization Model](./auth-and-organization-model.md)
- [Tasks System](./tasks-system.md)
- [Desktop Agent Runtime](./desktop-agent-runtime.md)

## Constraints and migration notes

- live sync is tightly tied to org-scoped JWT claims
- integrations are spread across route-handler families rather than one
  universal integration service
- this subsystem depends heavily on the current auth model, so auth convergence
  affects sync and external system boundaries directly
