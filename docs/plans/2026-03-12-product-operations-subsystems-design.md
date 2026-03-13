# Product Operations Subsystems Design

## Goal

Extend the subsystem architecture docs with a third batch focused on product
operations surfaces rather than developer execution.

This batch should explain how billing, organizations, device presence, and
analytics/telemetry are structured across apps, routes, shared packages, and
external services.

## Why this batch matters

The architecture docs now cover:

- app roles
- platform layers
- feature/project layers
- desktop execution layers

What is still missing is the operational side of the product:

- how organizations and members are managed
- how billing and subscription state flows
- how devices register online presence
- how product analytics and observability are collected and queried

## Recommended document set

Add these subsystem documents:

- `docs/architecture/subsystems/billing-and-subscription-operations.md`
- `docs/architecture/subsystems/organization-and-member-operations.md`
- `docs/architecture/subsystems/device-and-presence-operations.md`
- `docs/architecture/subsystems/analytics-and-observability.md`

Update subsystem indexes and the main architecture index to include them in the
reading order.

## Document scope

### Billing and subscription operations

Cover:

- `packages/trpc/src/router/billing`
- `packages/auth/src/stripe.ts`
- Better Auth + Stripe relationship in auth package
- desktop and web billing entrypoints
- billing-related email templates

### Organization and member operations

Cover:

- `packages/trpc/src/router/organization`
- Better Auth org/member/invitation schema
- OAuth consent organization selection
- invitation and logo/upload flows
- member lifecycle email hooks

### Device and presence operations

Cover:

- `packages/trpc/src/router/device`
- device heartbeat and online presence
- how desktop/mobile participate
- related MCP/device-oriented tools where relevant

### Analytics and observability

Cover:

- `packages/trpc/src/router/analytics`
- `packages/trpc/src/lib/posthog-client.ts`
- desktop analytics tracking
- web/admin/docs/marketing telemetry entrypoints
- feature-stack analytics packages
- Sentry/PostHog split at a high level

## Writing constraints

- stay architecture-first and code-light
- include real file paths and main libraries/services
- make clear when something belongs to the Superset-derived foundation versus
  the feature layer
- connect these operational subsystems back to auth, sync, and desktop docs
