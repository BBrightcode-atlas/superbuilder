# Tasks System

## Role

This subsystem provides structured project work tracking inside the product.

It is not only a UI list of tasks. It includes a database model, server feature
modules, typed APIs, desktop task views, comments, activities, labels, cycles,
projects, and agent kickoff helpers.

## Why it matters

Tasks are one of the main places where execution work becomes trackable and
automatable. They sit between planning and code execution.

That is why the task subsystem connects not only to CRUD-style screens but also
to agent command generation and workspace flows.

## Main libraries and runtime pieces

- Drizzle ORM for schema and relations
- NestJS + tRPC in the feature stack backend
- TanStack Router and React in desktop and feature clients
- shared agent command utilities

## Key code locations

### Data model

- `packages/drizzle/src/schema/features/task/index.ts`

This schema defines:

- task projects
- task cycles
- task labels
- task records
- task comments
- task activities

### Feature backend

- `packages/features-server/features/task/task.module.ts`
- `packages/features-server/features/task/service/task.service.ts`
- `packages/features-server/features/task/service/task-project.service.ts`
- `packages/features-server/features/task/service/task-cycle.service.ts`
- `packages/features-server/features/task/service/task-label.service.ts`
- `packages/features-server/features/task/service/task-comment.service.ts`
- `packages/features-server/features/task/service/task-activity.service.ts`
- `packages/features-server/features/task/trpc/task.route.ts`
- `packages/features-server/features/task/controller/task.controller.ts`

### Desktop task UI

- `apps/desktop/src/renderer/routes/_authenticated/_dashboard/tasks/page.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/_dashboard/tasks/components/TasksView/`
- `apps/desktop/src/renderer/routes/_authenticated/_dashboard/tasks/$taskId/page.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/_dashboard/tasks/$taskId/components/`

### Feature-app task UI

- `apps/features-app/src/features/task/`

### Agent command linkage

- `apps/desktop/src/renderer/routes/_authenticated/_dashboard/tasks/$taskId/utils/buildAgentCommand.ts`
- `apps/desktop/src/renderer/routes/_authenticated/_dashboard/tasks/$taskId/utils/deriveBranchName.ts`
- `packages/shared/src/agent-command.ts`

## Data flow

At a high level:

1. task data is stored in the feature-stack schema
2. feature-server task services expose projects, cycles, tasks, labels,
   comments, and activities through tRPC and controller layers
3. desktop and feature-app UIs consume those routes to render boards, lists,
   task detail views, and property sidebars
4. a task can be converted into an agent prompt or agent command, linking work
   tracking to execution

This makes tasks part of the operational workflow, not only part of reporting.

## Connected subsystems

- [CLI Agent Launchers](./cli-agent-launchers.md)
- [Workspace and Code Context](./workspace-and-code-context.md)
- [Feature and Project Engine](./feature-and-project-engine.md)

## Current constraints

- the task schema in the feature layer still shows feature-stack auth
  assumptions, including older profile-based references
- the desktop app has the deepest task UX today, even though task server logic
  lives in the feature stack
- task execution handoff currently depends on shared command builders rather
  than on a single end-to-end orchestration service
