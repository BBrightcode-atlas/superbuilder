# Analytics and Observability

## Role

This subsystem covers product telemetry, behavior analytics, analytics queries,
and high-level application observability.

It spans both the Superset-derived foundation and the feature layer.

## Why it matters

Without this layer, the repository would have little visibility into:

- onboarding funnels
- workspace and project usage
- chat and panel usage
- device and session health
- application errors in production

It is also one of the clearest examples of the repository using different tools
for different concerns rather than forcing one monitoring stack to do
everything.

## Main runtime boundaries

### Product analytics queries

The main analytics router uses PostHog queries and HogQL to produce business and
product insights for admin-facing experiences.

### Client telemetry

Web, admin, docs, marketing, desktop, and mobile all initialize PostHog in
their own environment-appropriate way.

### Desktop operational analytics

Desktop additionally tracks execution-heavy events such as workspace, project,
and terminal lifecycle moments.

### Observability

Sentry is used broadly for application error monitoring in the Next.js and
Electron surfaces.

## Libraries and services

- PostHog
- HogQL / PostHog query API
- Sentry
- Vercel KV fallback cache for analytics query results
- feature-layer PostHog integration

## Key code locations

### Analytics query layer

- `packages/trpc/src/router/analytics/analytics.ts`
- `packages/trpc/src/lib/posthog-client.ts`

### Desktop analytics

- `apps/desktop/src/main/lib/analytics/index.ts`
- `apps/desktop/src/renderer/lib/analytics/index.ts`
- `apps/desktop/src/renderer/lib/posthog.ts`
- `apps/desktop/src/renderer/providers/PostHogProvider/PostHogProvider.tsx`

### Web/admin/docs/marketing telemetry entrypoints

- `apps/web/src/instrumentation-client.ts`
- `apps/admin/src/instrumentation-client.ts`
- `apps/docs/src/instrumentation-client.ts`
- `apps/marketing/src/instrumentation-client.ts`

### Feature-layer analytics

- `packages/features-client/core/analytics/`
- `packages/features-server/features/analytics/`
- `packages/features-server/core/analytics/`

### Observability entrypoints

- `apps/web/src/instrumentation.ts`
- `apps/admin/src/instrumentation.ts`
- `apps/docs/src/instrumentation.ts`
- `apps/api/src/instrumentation.ts`
- `apps/desktop/src/main/lib/sentry`
- `apps/desktop/src/renderer/lib/sentry.ts`

## Flow

There are two main patterns.

### Product analytics

1. clients emit telemetry events to PostHog
2. server-side analytics queries read aggregate PostHog data through shared
   query helpers
3. admin or internal surfaces render funnels, retention, and leaderboard-style
   summaries

### Observability

1. app runtimes initialize Sentry at startup
2. errors and runtime failures are captured in each environment-appropriate app
3. analytics and observability remain adjacent but distinct concerns

## Important distinction

This subsystem is intentionally split:

- PostHog is primarily for product analytics and usage telemetry
- Sentry is primarily for error and runtime observability

That split keeps behavioral reporting separate from failure monitoring.

## Connected subsystems

- [Desktop Agent Runtime](./desktop-agent-runtime.md)
- [Chat and Agent Conversation Runtime](./chat-and-agent-conversation-runtime.md)
- [Auth and Organization Model](./auth-and-organization-model.md)

## Constraints and migration notes

- telemetry is implemented across many apps, so consistency depends on shared
  event naming and common identify/reset patterns
- the feature layer has its own analytics surface rather than relying only on
  the main Superset-derived query layer
- analytics and observability are both broad concerns, so this doc should be
  read as a map of responsibilities rather than as a complete inventory of every
  event
