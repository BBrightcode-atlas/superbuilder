# Integration Provider Surfaces

## Role

This subsystem connects external SaaS providers into the product.

The most visible providers today are GitHub, Linear, and Slack. Their
integration surfaces are distributed across web settings pages, shared tRPC
routers, API route handlers, OAuth state management, webhook ingestion, and
background job fan-out.

## Why it matters

Integrations are not isolated add-ons. They feed directly into:

- project and repository setup
- task and issue synchronization
- chat and workflow automation
- organization-scoped operational context

This subsystem is where external systems start affecting the internal product
graph.

## Main libraries and runtime pieces

- Next.js App Router pages for settings and consent UX
- Next.js route handlers for OAuth callbacks and webhook entrypoints
- tRPC for organization-scoped connection state
- Better Auth session access for authenticated initiation flows
- Drizzle ORM for connection storage
- provider SDKs and APIs:
  - `@octokit/app`, `@octokit/rest`, `@octokit/webhooks`
  - `@linear/sdk`
  - `@slack/web-api`
- Upstash QStash for deferred sync and event jobs

## Key code locations

### Shared connection and provider routers

- `packages/trpc/src/router/integration/integration.ts`
- `packages/trpc/src/router/integration/utils.ts`
- `packages/trpc/src/router/integration/github/github.ts`
- `packages/trpc/src/router/integration/linear/linear.ts`
- `packages/trpc/src/router/integration/slack/slack.ts`

This layer provides the shared platform contract for:

- listing organization connections
- verifying org membership
- reading provider-specific installation or connection state
- exposing provider operations to web and desktop clients

### Web integration settings surfaces

- `apps/web/src/app/(dashboard)/integrations/page.tsx`
- `apps/web/src/app/(dashboard)/integrations/github/page.tsx`
- `apps/web/src/app/(dashboard)/integrations/linear/page.tsx`
- `apps/web/src/app/(dashboard)/integrations/slack/page.tsx`
- `apps/web/src/app/(dashboard)/integrations/components/IntegrationCard/`

These pages are the user-facing control panel for integrations:

- discovery and settings
- connection status display
- provider-specific controls
- repository or team selection where applicable

### OAuth consent and organization selection

- `apps/web/src/app/oauth/consent/page.tsx`
- `apps/web/src/app/oauth/consent/components/ConsentForm/ConsentForm.tsx`

This surface matters because provider authorization is organization-scoped.
The consent form explicitly selects the active organization before completing
OAuth consent.

### API OAuth and webhook entrypoints

- `apps/api/src/app/api/integrations/slack/connect/route.ts`
- `apps/api/src/app/api/integrations/slack/link/route.ts`
- `apps/api/src/app/api/integrations/slack/events/route.ts`
- `apps/api/src/app/api/integrations/slack/interactions/route.ts`
- `apps/api/src/app/api/integrations/linear/callback/route.ts`
- `apps/api/src/app/api/integrations/linear/webhook/route.ts`

These route handlers are where provider traffic actually enters the system:

- OAuth redirect and callback handling
- signed state verification
- membership re-validation
- connection token storage
- webhook signature validation
- queueing follow-up jobs and initial syncs

## Operational flow

At a high level:

1. a user opens the web integration settings surface for an organization
2. shared tRPC routers return connection state and provider-specific details
3. the user starts OAuth or installation from the web UI
4. API route handlers complete callback processing, verify state and
   organization membership, and store or update connection records
5. webhook and event handlers accept provider events and either process them
   directly or hand work to background job infrastructure such as QStash

GitHub, Linear, and Slack use different provider mechanics, but they all follow
the same system boundary pattern: web UI for control, API for ingress, shared
router for internal consumption, and org-scoped persistence in the database.

## Connected subsystems

- [Auth and Organization Model](./auth-and-organization-model.md)
- [Organization and Member Operations](./organization-and-member-operations.md)
- [Tasks System](./tasks-system.md)
- [Project and Workspace Operations](./project-and-workspace-operations.md)

## Current constraints

- integration orchestration is still concentrated in the Superset-derived web
  and API layer rather than in the newer feature-stack services
- provider logic is structurally split between shared tRPC routers and Next.js
  route handlers, so no single package fully describes a provider
- organization selection is a first-class concern for integrations, which means
  auth and consent behavior must stay aligned with the org model during ongoing
  Better Auth migration work
