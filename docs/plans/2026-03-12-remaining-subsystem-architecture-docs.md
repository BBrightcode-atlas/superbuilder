# Remaining Subsystem Architecture Docs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the remaining subsystem architecture documents covering project
and workspace operations, provider integration surfaces, deployment/runtime
topology, and the feature vertical map.

**Architecture:** Extend `docs/architecture/subsystems/` with four additional
documents that connect the Superset-derived platform and the newer superbuilder
feature stack. These docs should emphasize real runtime boundaries, key
libraries, code locations, and how the system is assembled end-to-end.

**Tech Stack:** Markdown documentation, Bun, Turborepo, Next.js 16, Electron,
NestJS, Hono, Drizzle ORM, tRPC, Better Auth, Upstash QStash, Vercel, Fly.io,
Cloudflare Workers.

---

### Task 1: Update index coverage

**Files:**
- Modify: `docs/architecture/README.md`
- Modify: `docs/architecture/subsystems/README.md`

**Step 1: Add the new documents**

Extend the architecture indexes and reading order with the four new subsystem
documents.

### Task 2: Document project and workspace operations

**Files:**
- Create: `docs/architecture/subsystems/project-and-workspace-operations.md`

**Step 1: Explain the split model**

Describe the difference between remote org/project/workspace records and
desktop-local project/worktree/workspace records.

**Step 2: Record key code locations**

Reference the TRPC routers, desktop local routers, workspace-service manager,
runtime registry, and init flow.

### Task 3: Document integration provider surfaces

**Files:**
- Create: `docs/architecture/subsystems/integration-provider-surfaces.md`

**Step 1: Explain provider integration shape**

Describe how settings pages, OAuth callbacks, connection records, and webhook or
job entrypoints are divided across web, API, and shared routers.

**Step 2: Record key code locations**

Reference GitHub, Linear, and Slack UI and API surfaces plus the shared
integration router package.

### Task 4: Document deployment and runtime topology

**Files:**
- Create: `docs/architecture/subsystems/deployment-and-runtime-topology.md`

**Step 1: Explain runtime placement**

Describe which surfaces run as desktop binaries, Next.js apps, Hono/Nest
services, serverless functions, Workers, and Fly-managed infrastructure.

**Step 2: Record key code locations**

Reference root scripts, app manifests, Vercel configs, Electron builder files,
Fly config, and Electric proxy manifests.

### Task 5: Document the feature vertical map

**Files:**
- Create: `docs/architecture/subsystems/feature-vertical-map.md`

**Step 1: Explain vertical slice composition**

Describe how a feature is distributed across client app routes, admin routes,
server modules, schema, widgets, shared client core, and generation tooling.

**Step 2: Record representative examples**

Use concrete verticals such as `agent-desk`, `task`, `content-studio`, and
`marketing` to show how the feature stack is assembled.

### Task 6: Verify consistency

**Files:**
- Verify: `docs/architecture/**/*.md`

**Step 1: Check reading order**

Make sure the new documents fit the existing progression from app roles to
subsystems to platform layers.

**Step 2: Check coverage**

Ensure each new document clearly states role, libraries, code locations, main
flow, and current migration constraints.
