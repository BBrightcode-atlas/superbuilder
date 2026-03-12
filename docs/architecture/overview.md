# System Overview

## Summary

This repository is a Bun and Turborepo monorepo built from a Superset fork and
is being reshaped into a `superbuilder` system.

The important architectural point is not that it has two equal long-term
stacks. The important point is that it contains:

- a legacy Superset-derived application and package layer, still using the
  `@superset/*` namespace in many places
- a newer `@superbuilder/*` layer that adds feature generation, feature
  management, agent workflows, and project-building capabilities

The intended direction is convergence. `@superset/*` is best read as the current
base that is being absorbed into a broader `superbuilder` platform rather than
as the final brand or final system boundary.

## System purpose

At a product level, this repository is becoming a combined creation system:

- start from code and workspace context
- derive or manage reusable features
- compose those features into larger project surfaces
- support that flow with admin tools, agent tooling, auth, sync, and shared UI

That is why the repo contains both classic product surfaces and a dedicated
feature subsystem. The feature subsystem is not an unrelated sidecar. It is part
of the system's broader creation pipeline.

## Legacy base and emerging layer

### 1. Superset-derived base

The Superset-derived layer is the current operational base of the repository.

It includes apps such as:

- `apps/web` for the primary authenticated product UI
- `apps/api` for HTTP APIs, auth routes, integrations, and tRPC endpoints
- `apps/admin` for internal admin analytics and management
- `apps/marketing` for the public site and content marketing surface
- `apps/docs` for documentation
- `apps/desktop` for the Electron desktop product
- `apps/mobile` for the React Native mobile product

It also includes core packages such as:

- `@superset/auth`
- `@superset/db`
- `@superset/trpc`
- `@superset/ui`
- `@superset/shared`
- `@superset/mcp`
- `@superset/workspace-service`

This layer provides much of the current runtime foundation: Better Auth,
Drizzle with Neon/Postgres, Next.js web surfaces, Electron desktop runtime,
Expo mobile runtime, and shared typed APIs through tRPC.

### 2. Superbuilder feature and project layer

The newer `@superbuilder/*` layer is where the repository becomes a feature and
project creation system rather than only an application suite.

It combines Superset-derived infrastructure with Feature Atlas-style
capabilities and conventions.

It includes:

- `apps/features-app`
- `apps/features-landing/landing`
- `apps/feature-admin`
- `apps/features-server`
- `apps/agent-server`

It also includes shared packages such as:

- `@superbuilder/features-client`
- `@superbuilder/features-server`
- `@superbuilder/feature-ui`
- `@superbuilder/widgets`
- `@superbuilder/drizzle`
- `@superbuilder/atlas-engine`
- `@superbuilder/features-cli`

This layer introduces the feature folder system, feature-specific client and
server contracts, widgets, generation helpers, and feature admin surfaces.

Conceptually, this is the part of the repo that moves toward:

- code-aware tooling
- feature creation and management
- project composition built from feature units

It still carries some older Supabase-era patterns in places while moving toward
the same Better Auth direction used by the Superset-derived base.

## High-level runtime map

### User-facing product surfaces

- `apps/web` is the main authenticated browser app
- `apps/marketing` is the public acquisition and content site
- `apps/docs` is the documentation site
- `apps/mobile` is the mobile surface
- `apps/desktop` is the richest local workstation client
- `apps/features-landing/landing` is a feature-system-specific landing/template surface

### Product backends and service layers

- `apps/api` is the main Next.js API surface for the Superset-derived base
- `apps/features-server` is the NestJS backend for the feature and project layer
- `apps/agent-server` is a Hono-based AI and streaming server for feature agents
- `packages/workspace-service` is a focused Hono + tRPC service used by the desktop app

### Infrastructure and support services

- `apps/electric-proxy` authorizes and filters Electric SQL sync traffic
- `apps/streams` is currently only a placeholder package, not a developed runtime surface
- `apps/workers` contains standalone remote-control and webhook tooling

## Core architectural ideas

### A. Shared packages define the real platform boundaries

Most applications stay thin by depending on shared packages rather than
redefining infrastructure locally.

Examples:

- auth logic is centralized in `packages/auth`
- database schema is centralized in `packages/db`
- typed procedure routers are centralized in `packages/trpc`
- reusable UI is centralized in `packages/ui`
- desktop-specific local persistence is centralized in `packages/local-db`

The newer superbuilder layer follows the same package-first pattern:

- server feature logic in `packages/features-server`
- client feature utilities in `packages/features-client`
- feature UI in `packages/feature-ui`
- reusable connected feature widgets in `packages/widgets`

### B. Namespace split does not equal product split

The `@superset/*` and `@superbuilder/*` namespaces should be read as a migration
artifact and responsibility split, not as proof of two unrelated products.

The repository is converging toward one larger system where the older namespace
provides a lot of the infrastructure base and the newer namespace provides the
feature and project composition model.

### C. Auth and identity are becoming a cross-platform concern

The Superset-derived base already uses Better Auth and exposes session-aware APIs
across web, desktop, and mobile. The feature layer is still in migration and
currently mixes older Supabase-oriented assumptions with a newer Better Auth
direction.

That means the repository is not just multi-app; it is also mid-transition in
its identity model while the platform converges.

### D. Agents are a first-class subsystem

This is not a simple CRUD product monorepo. Agent execution, MCP, remote tools,
workspace orchestration, and AI-assisted flows are central to the product.

That shows up in:

- `packages/agent`
- `packages/chat`
- `packages/chat-mastra`
- `packages/mcp`
- `packages/desktop-mcp`
- `packages/workspace-service`
- `apps/api` agent endpoints
- `apps/desktop` agent orchestration UX
- `apps/agent-server` in the feature and project layer

### E. The desktop app is the thickest client

The Electron app is not a shell around a website. It has distinct main,
preload, and renderer boundaries, local persistence, agent orchestration,
terminal management, protocol/deep-link handling, and integration with MCP and
workspace services.

## Main external services

The repository integrates with a wide range of infrastructure:

- Neon / Postgres for primary relational data
- Better Auth for auth, sessions, orgs, API keys, and OAuth flows
- Stripe for billing and subscription lifecycle
- Resend / React Email for email delivery
- PostHog for analytics
- Sentry for error monitoring
- Electric SQL for sync and live data distribution
- Upstash for queueing and rate limiting
- Vercel Blob and KV in parts of the Superset stack
- Slack, Linear, GitHub, and OAuth provider integrations
- Anthropic, OpenAI, Google, and Mastra for agent/model workflows

## Recommended mental model

Treat the repo as three connected layers:

1. Product surfaces
   Web, desktop, mobile, marketing, docs, admin.

2. Shared platform
   Auth, DB, tRPC, shared UI, MCP, chat, local sync, workspace orchestration.

3. Feature and project creation layer
   The part of the system that turns code and product context into managed
   features and then uses those features to build larger project surfaces.

If you start with this model, the repository becomes much easier to reason
about than if you assume it is a single unified app.
