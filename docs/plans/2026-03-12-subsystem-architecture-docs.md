# Subsystem Architecture Docs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a subsystem-focused documentation layer under `docs/architecture/`
that explains the major internal capabilities, libraries, runtime boundaries,
and real code locations behind the system.

**Architecture:** Extend the current architecture docs with a new
`subsystems/` section. Use a consistent template across a small set of deep-dive
documents so a reader can move from overview, to apps, to subsystem internals,
to shared platform details without reading source code first.

**Tech Stack:** Markdown documentation, Bun/Turbo monorepo, Electron, Next.js,
NestJS, Hono, Better Auth, Drizzle ORM, tRPC, MCP, Mastra, AI SDKs.

---

### Task 1: Create subsystem doc spine

**Files:**
- Modify: `docs/architecture/README.md`
- Create: `docs/architecture/subsystems/README.md`

**Step 1: Add subsystem docs to the reading order**

Update the main architecture index so subsystem docs appear between app docs and
platform docs.

**Step 2: Create subsystem index**

Write an index that explains why subsystem docs exist, what each document
covers, and what order to read them in.

### Task 2: Document desktop agent runtime

**Files:**
- Create: `docs/architecture/subsystems/desktop-agent-runtime.md`

**Step 1: Map runtime boundaries**

Describe Electron main, preload, renderer, terminal host, chat panes, and MCP
touchpoints.

**Step 2: Record key code locations**

Reference the desktop renderer/main folders and the supporting packages that
make the runtime work.

### Task 3: Document CLI agent launchers

**Files:**
- Create: `docs/architecture/subsystems/cli-agent-launchers.md`

**Step 1: Explain supported agent CLIs**

Cover Claude Code, Codex, OpenCode, Gemini-facing model/tooling connections,
and how they are surfaced through the system.

**Step 2: Record wrappers and launch points**

Reference external wrapper docs, desktop hooks, and feature-server execution
helpers where those CLIs are launched or coordinated.

### Task 4: Document tasks system

**Files:**
- Create: `docs/architecture/subsystems/tasks-system.md`

**Step 1: Explain task domain structure**

Cover the task schema, server modules, UI consumers, and where task data is
used in chat/tool flows.

**Step 2: Record key code locations**

Reference schema, feature server, and desktop task UI paths.

### Task 5: Document workspace and code context

**Files:**
- Create: `docs/architecture/subsystems/workspace-and-code-context.md`

**Step 1: Explain workspace orchestration**

Cover desktop workspaces, local context, workspace service, and code-aware
runtime boundaries.

**Step 2: Record key code locations**

Reference desktop workspaces UI, `packages/workspace-service`, and related
supporting packages.

### Task 6: Document feature and project engine

**Files:**
- Create: `docs/architecture/subsystems/feature-and-project-engine.md`

**Step 1: Explain feature-to-project composition**

Describe the packages and apps that support feature generation, feature
management, and project-level composition.

**Step 2: Record key code locations**

Reference `packages/atlas-engine`, `packages/features-cli`,
`packages/features-server/features/*`, and related feature apps.

### Task 7: Document auth and organization model

**Files:**
- Create: `docs/architecture/subsystems/auth-and-organization-model.md`

**Step 1: Explain the current identity split**

Describe the Better Auth-centered base and the feature-layer migration without
dropping into implementation details.

**Step 2: Record key code locations**

Reference the main auth package, DB schema, feature auth paths, and any shared
org/session boundaries.

### Task 8: Document sync and integrations

**Files:**
- Create: `docs/architecture/subsystems/sync-and-integrations.md`

**Step 1: Explain sync and external system boundaries**

Describe Electric proxying, webhook hosts, third-party integration surfaces, and
operational service boundaries.

**Step 2: Record key code locations**

Reference `apps/api`, `apps/electric-proxy`, integration routes, and related
shared packages.

### Task 9: Verify consistency

**Files:**
- Verify: `docs/architecture/**/*.md`

**Step 1: Check framing consistency**

Make sure subsystem docs match the existing “Superset-derived foundation moving
toward superbuilder” explanation.

**Step 2: Check structure consistency**

Make sure each subsystem doc includes role, runtime boundaries, libraries, code
locations, flows, and migration notes.
