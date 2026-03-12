# Organization and Member Operations

## Role

This subsystem manages organization creation, membership, invitations, role
rules, logo updates, and consent-time organization selection.

It is the operational layer sitting on top of the repository's identity model.

## Why it matters

Organizations are used as more than a settings concept here. They shape:

- access scope
- billing scope
- sync scope
- invitation workflows
- OAuth consent scope

That makes org/member operations one of the product's most central operational
subsystems.

## Main runtime boundaries

### Better Auth organization model

The underlying org/member/invitation structure lives in the auth schema and
auth server configuration.

### Organization typed API

The organization router exposes create, update, lookup, and invitation-related
flows to product clients.

### Consent-time org selection

The OAuth consent surface lets a user choose which organization a client app
should access.

### Email lifecycle

Invitation and member-change messaging is handled in the shared email layer.

## Libraries and services

- Better Auth organization support
- Drizzle ORM
- tRPC
- upload helpers for logos/assets
- shared auth role utilities
- React Email templates

## Key code locations

### Auth foundation

- `packages/auth/src/server.ts`
- `packages/db/src/schema/auth.ts`
- `packages/auth/src/lib/accept-invitation-endpoint.ts`
- `packages/auth/src/lib/generate-magic-token.ts`
- `packages/auth/src/lib/rate-limit.ts`

### Organization API

- `packages/trpc/src/router/organization/organization.ts`

### Consent and selection UI

- `apps/web/src/app/oauth/consent/page.tsx`
- `apps/web/src/app/oauth/consent/components/ConsentForm/ConsentForm.tsx`

### Email templates

- `packages/email/src/emails/organization-invitation.tsx`
- `packages/email/src/emails/member-added.tsx`
- `packages/email/src/emails/member-removed.tsx`

## Flow

At a high level:

1. a user signs in and is associated with one or more organizations
2. auth/session state determines the active organization
3. organization routes allow owners or authorized members to inspect and mutate
   org state
4. invitation flows issue tokens, enforce limits, and send email invites
5. OAuth consent can switch the active organization before client access is
   granted

## Important distinction

The auth model and the organization-operations model are related but not the
same thing.

- auth defines identity and session structures
- organization operations define how those structures are used day-to-day by the
  product

## Connected subsystems

- [Billing and Subscription Operations](./billing-and-subscription-operations.md)
- [Auth and Organization Model](./auth-and-organization-model.md)
- [Device and Presence Operations](./device-and-presence-operations.md)

## Constraints and migration notes

- organization behavior is already strong in the Superset-derived foundation
- many downstream systems assume active organization state is always available
- this subsystem is one of the clearest examples of the platform converging
  toward organization-first operations rather than account-only operations
