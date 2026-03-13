# Dev Execution Subsystems Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a second batch of subsystem architecture docs that explains the
developer execution layer: chat runtimes, MCP tooling, terminal/session
infrastructure, and local persistence.

**Architecture:** Extend `docs/architecture/subsystems/` with four new
documents. Each document should explain role, runtime boundaries, libraries,
code locations, execution flow, and how the subsystem supports the broader
superbuilder workflow.

**Tech Stack:** Markdown documentation, Electron, TanStack Router, Hono, tRPC,
Mastra, MCP, PTY/terminal infrastructure, local SQLite state.

---

### Task 1: Update subsystem indexes

**Files:**
- Modify: `docs/architecture/README.md`
- Modify: `docs/architecture/subsystems/README.md`

**Step 1: Extend the reading order**

Add the new dev-execution subsystem docs to the architecture indexes.

**Step 2: Keep the sequence readable**

Place these docs after the existing desktop/runtime and workspace docs so the
reading order stays logical.

### Task 2: Document chat and agent conversation runtime

**Files:**
- Create: `docs/architecture/subsystems/chat-and-agent-conversation-runtime.md`

**Step 1: Explain conversation runtime structure**

Cover `packages/chat`, `packages/chat-mastra`, `packages/agent`, and desktop
chat-pane surfaces.

**Step 2: Record key code locations**

Reference client, host, slash-command, and server/runtime folders.

### Task 3: Document MCP tooling surfaces

**Files:**
- Create: `docs/architecture/subsystems/mcp-tooling-surfaces.md`

**Step 1: Explain MCP roles**

Describe how generic MCP services and desktop-specific MCP capabilities are
exposed.

**Step 2: Record key code locations**

Reference `packages/mcp`, `packages/desktop-mcp`, and desktop MCP-aware entry
points.

### Task 4: Document terminal and session infrastructure

**Files:**
- Create: `docs/architecture/subsystems/terminal-and-session-infrastructure.md`

**Step 1: Explain terminal backend shape**

Cover daemon layers, terminal host, PTY/session lifecycle, and reconnect logic.

**Step 2: Record key code locations**

Reference main-process terminal folders and renderer terminal panes.

### Task 5: Document local state and persistence

**Files:**
- Create: `docs/architecture/subsystems/local-state-and-persistence.md`

**Step 1: Explain local persistence responsibilities**

Cover local DB, app state, workspace-local state, and where durability exists on
the machine.

**Step 2: Record key code locations**

Reference `packages/local-db`, desktop app-state paths, and related local
runtime files.

### Task 6: Verify consistency

**Files:**
- Verify: `docs/architecture/**/*.md`

**Step 1: Check narrative continuity**

Make sure the new docs fit the same Superset-derived to superbuilder framing.

**Step 2: Check linkability**

Make sure the new docs link cleanly with the earlier subsystem docs.
