# Product Operations Subsystems Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a third subsystem-doc batch that explains billing, organization
operations, device presence, and analytics/observability across the repository.

**Architecture:** Extend `docs/architecture/subsystems/` with four product
operations documents. Each document should explain role, runtime boundaries,
libraries, real code locations, and how the operational flow works across web,
API, shared packages, and external providers.

**Tech Stack:** Markdown documentation, Better Auth, Stripe, Drizzle ORM, tRPC,
PostHog, Sentry, Next.js route handlers, Electron telemetry hooks.

---

### Task 1: Update indexes

**Files:**
- Modify: `docs/architecture/README.md`
- Modify: `docs/architecture/subsystems/README.md`

**Step 1: Add the new operation docs**

Extend the architecture indexes with the new billing, organization, device, and
analytics docs.

### Task 2: Document billing and subscription operations

**Files:**
- Create: `docs/architecture/subsystems/billing-and-subscription-operations.md`

**Step 1: Explain the billing flow**

Cover Stripe integration points, billing router behavior, and desktop/web entry
surfaces.

**Step 2: Record key code locations**

Reference auth, TRPC, email, and billing UI paths.

### Task 3: Document organization and member operations

**Files:**
- Create: `docs/architecture/subsystems/organization-and-member-operations.md`

**Step 1: Explain org/member lifecycle**

Cover org creation, membership, invitations, slug/logo updates, and consent-time
org selection.

**Step 2: Record key code locations**

Reference auth schema, org router, and consent/invitation-related surfaces.

### Task 4: Document device and presence operations

**Files:**
- Create: `docs/architecture/subsystems/device-and-presence-operations.md`

**Step 1: Explain device presence**

Cover heartbeat, online device listing, and relation to multi-device product
behavior.

**Step 2: Record key code locations**

Reference device router, device schema usage, and any device-oriented tool
surfaces.

### Task 5: Document analytics and observability

**Files:**
- Create: `docs/architecture/subsystems/analytics-and-observability.md`

**Step 1: Explain telemetry layers**

Cover product analytics, server-side analytics queries, feature-layer analytics,
and high-level Sentry observability placement.

**Step 2: Record key code locations**

Reference analytics routers, PostHog clients, desktop tracking, and app
instrumentation entrypoints.

### Task 6: Verify consistency

**Files:**
- Verify: `docs/architecture/**/*.md`

**Step 1: Check subsystem fit**

Ensure the new docs fit the current architecture framing and subsystem reading
order.

**Step 2: Check coverage**

Ensure each doc clearly answers what the subsystem does, which libraries it
uses, and where the real code lives.
