# System Overview

## Summary

This repository (`superbuilder`) is one of three repositories that together form
the superbuilder platform. It is a Bun and Turborepo monorepo originally forked
from Superset, now fully shaped into the builder tool layer of the 3-repo
architecture.

## 3-Repo Architecture

The platform is split across three repositories with clear responsibility
boundaries:

| Repo | Role | Working branch | Stable branch |
|------|------|---------------|---------------|
| `BBrightcode-atlas/superbuilder` | Builder tool (Desktop, atlas-engine, Registry) | `develop` | `main` |
| `BBrightcode-atlas/superbuilder-features` | Feature code (each feature in `features/{name}/`) | `main` | `main` |
| `BBrightcode-atlas/superbuilder-app-boilerplate` | Empty app template with `[ATLAS:*]` markers | `develop` | `develop` |

**Feature code lives exclusively in `superbuilder-features`.** This repo
(superbuilder) contains only the tooling that queries, composes, and deploys
features — not the features themselves.

For the full 3-repo architecture spec see
`docs/architecture/three-repo-architecture.md`.

## System purpose

At a product level, the superbuilder platform is a combined creation system:

- start from code and workspace context
- discover and manage reusable features (via `superbuilder-features`)
- compose those features into new project surfaces (via `superbuilder-app-boilerplate`)
- support that flow with Desktop tooling, agent workflows, atlas-engine, and
  shared infrastructure

## This repo: builder tool layer

### Apps in `superbuilder`

- `apps/web` — main authenticated browser UI (app.superset.sh)
- `apps/api` — HTTP APIs, auth routes, integrations, and tRPC endpoints
- `apps/admin` — internal admin analytics and management
- `apps/marketing` — public acquisition and content site (superset.sh)
- `apps/docs` — documentation site
- `apps/desktop` — Electron desktop product; primary orchestration surface for
  Atlas workflows
- `apps/mobile` — React Native mobile product (Expo)

### Core packages in `superbuilder`

- `@superset/auth` — Better Auth server + client
- `@superset/db` — Drizzle schema, Feature Studio schema (migrated 2026-03-13)
- `@superset/trpc` — typed procedure routers, Feature Studio router (migrated 2026-03-13)
- `@superset/ui` — shadcn/ui components, TailwindCSS v4
- `@superset/shared` — cross-app types, constants, auth helpers
- `@superset/mcp` — MCP server and tool registration
- `@superset/desktop-mcp` — desktop-specific MCP exposure
- `@superset/local-db` — desktop-local persistence
- `@superset/workspace-service` — workspace orchestration service
- `@superset/chat` / `@superset/chat-mastra` — chat and Mastra integration
- `@superset/agent` — agent orchestration primitives
- `@superset/email` — email templates and rendering
- `@superbuilder/atlas-engine` — feature manifest scanning, dependency
  resolution, scaffold, and pipeline

## Legacy apps (삭제됨)

> **Legacy (삭제됨):** The following apps were part of an earlier single-repo
> architecture where feature code lived inside `superbuilder`. They have been
> deleted as the platform migrated to the 3-repo model. Their responsibilities
> now live in `superbuilder-features` and `superbuilder-app-boilerplate`.

| Deleted app | Current equivalent |
|-------------|-------------------|
| `apps/features-app` | `superbuilder-app-boilerplate/apps/app` |
| `apps/features-landing` / `apps/features-landing/landing` | `superbuilder-app-boilerplate/apps/landing` |
| `apps/feature-admin` | `superbuilder-app-boilerplate/apps/admin` |
| `apps/features-server` | Feature modules in `superbuilder-features/features/*/` |
| `apps/agent-server` | Replaced by Mastra-based agent runtime in Desktop |

## Legacy packages (삭제됨)

> **Legacy (삭제됨):** The following packages were part of the earlier
> single-repo architecture. They have been deleted. Their responsibilities have
> moved to `superbuilder-features` (per-feature) or been absorbed into existing
> `@superset/*` packages.

| Deleted package | Current equivalent |
|-----------------|-------------------|
| `packages/features-server` (`@superbuilder/features-server`) | Feature server modules in `superbuilder-features/features/*/server/` |
| `packages/feature-ui` (`@superbuilder/feature-ui`) | Per-feature UI in `superbuilder-features/features/*/` |
| `packages/features-db` (`@superbuilder/drizzle`) | Per-feature DB schema in `superbuilder-features/features/*/`; platform schema in `@superset/db` |
| `packages/features-cli` (`@superbuilder/features-cli`) | CLI tooling absorbed into `@superbuilder/atlas-engine` |
| `packages/widgets` (`@superbuilder/widgets`) | Per-feature widget code in `superbuilder-features` |

## High-level runtime map (current)

### User-facing product surfaces

- `apps/web` — main authenticated browser app
- `apps/marketing` — public acquisition and content site
- `apps/docs` — documentation site
- `apps/mobile` — mobile surface
- `apps/desktop` — richest local workstation client; Atlas orchestration hub

### Product backends

- `apps/api` — main Next.js API for web/admin/desktop
- `packages/workspace-service` — Hono + tRPC service used by Desktop

### Infrastructure and support services

- `apps/electric-proxy` — authorizes and filters Electric SQL sync traffic
- `apps/workers` — remote-control and webhook tooling

## Core architectural ideas

### A. Shared packages define the real platform boundaries

Most applications stay thin by depending on shared packages rather than
redefining infrastructure locally.

- auth logic is centralized in `packages/auth`
- database schema is centralized in `packages/db`
- typed procedure routers are centralized in `packages/trpc`
- reusable UI is centralized in `packages/ui`
- desktop-specific local persistence is centralized in `packages/local-db`
- feature scanning/resolution/scaffold is centralized in `packages/atlas-engine`

### B. Feature code lives in a separate repo

Feature code (server modules, client pages, DB schema, UI components per
feature) lives in `superbuilder-features`. This repo contains only the tooling
to discover, resolve, and scaffold those features. The `superbuilder-app-boilerplate`
repo contains the empty app template that receives scaffolded feature code.

### C. Auth and identity are a cross-platform concern

Better Auth provides session-aware APIs across web, desktop, and mobile. All
new feature code in `superbuilder-features` targets the same Better Auth
foundation.

### D. Agents are a first-class subsystem

Agent execution, MCP, remote tools, workspace orchestration, and AI-assisted
flows are central to the product.

Key locations:

- `packages/agent`
- `packages/chat`
- `packages/chat-mastra`
- `packages/mcp`
- `packages/desktop-mcp`
- `packages/workspace-service`
- `apps/api` agent endpoints
- `apps/desktop` agent orchestration UX and Atlas routers

### E. The desktop app is the thickest client

The Electron app has distinct main, preload, and renderer boundaries, local
persistence, agent orchestration, terminal management, protocol/deep-link
handling, and integration with MCP and workspace services. It is also the
primary UI for Atlas workflows (Feature Studio, Composer, Catalog, Deployments).

## Main external services

- Neon / Postgres for primary relational data
- Better Auth for auth, sessions, orgs, API keys, and OAuth flows
- Stripe for billing and subscription lifecycle
- Resend / React Email for email delivery
- PostHog for analytics
- Sentry for error monitoring
- Electric SQL for sync and live data distribution
- Upstash for queueing and rate limiting
- Vercel for hosting and deployment pipeline (also managed via atlas-engine)
- Slack, Linear, GitHub, and OAuth provider integrations
- Anthropic, OpenAI, Google, and Mastra for agent/model workflows

## Recommended mental model

Treat the platform as three connected repos, each with a clear job:

1. **`superbuilder`** (this repo) — builder tooling
   Desktop app, atlas-engine, shared platform packages, API, web UI.

2. **`superbuilder-features`** — feature library
   The catalog of reusable features. Each feature owns its server, client, DB
   schema, and UI code. Features are discovered by atlas-engine via `feature.json`.

3. **`superbuilder-app-boilerplate`** — app template
   An empty shell with `[ATLAS:*]` markers. scaffold() clones this and fills it
   with the selected features from `superbuilder-features`.

If you understand these three repos and their data flow, the entire system
becomes straightforward to reason about.
