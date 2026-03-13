# Architecture Reverse Engineering Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce a reader-friendly architecture map for this repository under
`docs/architecture/`, organized by overall system, individual apps, and shared
platform layers.

**Architecture:** Start with a top-level explanation of the monorepo as a
Superset-derived base converging into a broader `superbuilder` system, then
drill down into app responsibilities, and finally explain the common runtime
services such as auth, data, MCP, and build orchestration.

**Tech Stack:** Bun, Turborepo, Next.js, Electron, React Native, NestJS, Hono,
Better Auth, Drizzle ORM, tRPC, Electric SQL, Mastra/MCP.

---

### Task 1: Create the documentation spine

**Files:**
- Create: `docs/architecture/README.md`
- Create: `docs/architecture/overview.md`

**Step 1: Write the reading order**

Explain how a new engineer should move from overview to app docs to platform docs.

**Step 2: Write the system-level map**

Describe the monorepo at a high level, including the Superset fork lineage, the
legacy `@superset/*` namespace, and the newer `@superbuilder/*` layer for
feature and project creation.

### Task 2: Document each app by role

**Files:**
- Create: `docs/architecture/apps/web.md`
- Create: `docs/architecture/apps/api.md`
- Create: `docs/architecture/apps/admin.md`
- Create: `docs/architecture/apps/marketing.md`
- Create: `docs/architecture/apps/docs-site.md`
- Create: `docs/architecture/apps/desktop.md`
- Create: `docs/architecture/apps/mobile.md`
- Create: `docs/architecture/apps/features-app.md`
- Create: `docs/architecture/apps/feature-admin.md`
- Create: `docs/architecture/apps/features-server.md`
- Create: `docs/architecture/apps/agent-server.md`
- Create: `docs/architecture/apps/electric-proxy.md`
- Create: `docs/architecture/apps/workers.md`

**Step 1: Explain the app’s job**

For each app, write who it serves, which runtime it uses, and what adjacent
packages or services it depends on.

**Step 2: Explain the app’s internal shape**

Use folder and runtime boundaries rather than line-by-line code detail.

### Task 3: Document the shared platform layers

**Files:**
- Create: `docs/architecture/platform/shared-packages.md`
- Create: `docs/architecture/platform/data-and-auth.md`
- Create: `docs/architecture/platform/agent-and-mcp.md`
- Create: `docs/architecture/platform/build-and-runtime.md`

**Step 1: Describe package responsibilities**

Explain how shared packages distribute auth, DB, UI, tRPC, MCP, chat, and
workspace functionality.

**Step 2: Describe data and runtime flow**

Explain how requests, sessions, database access, sync, background work, and
agent orchestration move through the system.

### Task 4: Verify the docs

**Files:**
- Verify: `docs/architecture/**/*.md`

**Step 1: Read for consistency**

Make sure the same package or app is described the same way across documents.

**Step 2: Check that the docs stay code-light**

Keep the focus on architecture, structure, libraries, services, and runtime
boundaries rather than implementation walkthroughs.
