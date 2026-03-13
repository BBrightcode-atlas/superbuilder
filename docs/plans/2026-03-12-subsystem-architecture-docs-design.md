# Subsystem Architecture Docs Design

## Goal

Extend the new architecture documentation set with a second layer focused on
major internal subsystems rather than only apps and platform packages.

The purpose is to help a reader understand where important capabilities really
live in the codebase, which apps and packages participate, which libraries they
use, and how the runtime boundaries connect.

## Framing

The repository is being documented as a Superset-derived foundation converging
into a broader `superbuilder` system.

That means subsystem documents should not read like isolated feature notes.
They should explain how the current foundation and the newer feature/project
layer combine into larger operational capabilities.

## Audience

These docs are for an engineer or operator who needs to answer questions such
as:

- where multi-agent CLI launching actually happens
- how Claude, Codex, Gemini, OpenCode, and related runtimes are surfaced
- where the task system is defined and which apps consume it
- where workspace and code context are assembled
- how feature and project generation is wired together

## Recommended structure

Add a new section:

- `docs/architecture/subsystems/README.md`

Add deep-dive subsystem documents:

- `docs/architecture/subsystems/desktop-agent-runtime.md`
- `docs/architecture/subsystems/cli-agent-launchers.md`
- `docs/architecture/subsystems/tasks-system.md`
- `docs/architecture/subsystems/workspace-and-code-context.md`
- `docs/architecture/subsystems/feature-and-project-engine.md`
- `docs/architecture/subsystems/auth-and-organization-model.md`
- `docs/architecture/subsystems/sync-and-integrations.md`

Update the main architecture index so the reading order becomes:

1. overview
2. app documents
3. subsystem documents
4. platform documents

## Document template

Each subsystem document should use the same structure:

1. Role
2. Why it exists in the larger system
3. Main runtime boundaries
4. Libraries and external services
5. Key packages and real code locations
6. Data, request, or event flow
7. Connected apps and packages
8. Current constraints or migration notes

## Subsystem scope

### Desktop agent runtime

Explain how the Electron app acts as the thick orchestration surface for chat,
terminal, MCP, workspace tabs, and agent execution UX.

### CLI agent launchers

Explain how external CLIs such as Claude Code, Codex, and OpenCode are exposed,
wrapped, and integrated into desktop flows and server-side execution helpers.

### Tasks system

Explain the feature-stack task subsystem from schema to server feature modules to
desktop consumption and tool-call usage.

### Workspace and code context

Explain the local workspace orchestration layer, workspace service, desktop
workspace UI, and related context management.

### Feature and project engine

Explain the packages and apps that move from code/context into features and from
features into larger project-building flows.

### Auth and organization model

Explain the current split between the Better Auth-centered foundation and the
feature-layer migration path, without going line-by-line through auth code.

### Sync and integrations

Explain Electric proxying, third-party integrations, webhook surfaces, and the
operational service boundaries around sync and external systems.

## Writing constraints

- stay architecture-first, not implementation-tutorial style
- include real code paths, but do not dump code
- keep each document readable on its own
- prefer linking to app/platform docs instead of repeating large sections
- explicitly note migration boundaries where `@superset/*` and `@superbuilder/*`
  meet
