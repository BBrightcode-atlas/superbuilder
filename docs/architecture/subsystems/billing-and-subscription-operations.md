# Billing and Subscription Operations

## Role

This subsystem manages paid access, subscription state, invoices, and billing
entrypoints across the product.

It sits at the boundary between product identity and external payment
infrastructure.

## Why it matters

Billing is not implemented as a single isolated payments page. It is spread
across:

- Better Auth-related Stripe integration
- organization-linked subscription records
- web and desktop billing entry surfaces
- billing lifecycle emails

That distribution matters when tracing why a plan or invoice state looks wrong.

## Main runtime boundaries

### Auth and Stripe foundation

The core Stripe client and billing-aware auth behavior live under the auth
package. This is where the payment provider enters the platform foundation.

### Typed billing API

The billing router exposes billing data into the product's typed API surface.

### Product surfaces

Web provides a lightweight billing page and desktop remains the deeper billing
management surface.

### Billing email layer

Billing-related lifecycle messages are templated in the shared email package.

## Libraries and services

- Stripe
- Better Auth plugins and billing hooks
- tRPC
- Drizzle ORM
- React Email / Resend-style email rendering infrastructure

## Key code locations

### Stripe and auth integration

- `packages/auth/src/stripe.ts`
- `packages/auth/src/server.ts`

### Billing API

- `packages/trpc/src/router/billing/billing.ts`

### Subscription data model

- `packages/db/src/schema`
- subscription relations are referenced from auth and billing flows

### Product entrypoints

- `apps/web/src/app/(dashboard)/settings/billing/page.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/settings/billing/`

### Billing emails

- `packages/email/src/emails/payment-failed.tsx`
- `packages/email/src/emails/subscription-started.tsx`
- `packages/email/src/emails/subscription-cancelled.tsx`
- `packages/email/src/emails/member-added-billing.tsx`
- `packages/email/src/emails/member-removed-billing.tsx`

## Flow

At a high level:

1. organizations become the billing scope
2. auth and subscription records connect organization state to Stripe state
3. the billing router resolves invoice and subscription-related information for
   authenticated clients
4. web and desktop surfaces expose billing management entrypoints
5. email templates cover important lifecycle transitions like subscription
   activation, cancellation, and payment failure

## Connected subsystems

- [Organization and Member Operations](./organization-and-member-operations.md)
- [Auth and Organization Model](./auth-and-organization-model.md)
- [Sync and Integrations](./sync-and-integrations.md)

## Constraints and migration notes

- desktop remains an important billing surface even though web exposes a billing
  route
- billing state is organization-scoped rather than purely user-scoped
- the billing subsystem depends on auth correctness because active organization
  state determines which subscription records are queried
