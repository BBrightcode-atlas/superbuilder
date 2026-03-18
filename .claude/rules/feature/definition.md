---
description: Feature types and directory structure for current superbuilder feature work.
globs: "apps/features-app/src/features/**/*,apps/feature-admin/src/features/**/*,packages/features-server/features/**/*,packages/widgets/src/**/*"
alwaysApply: false
---

# Feature Definition

## What counts as a feature

A feature is a self-contained slice of product behavior that may include:

- client UI in `apps/features-app` and optionally `apps/feature-admin`
- server behavior in `packages/features-server/features`
- database schema in `packages/drizzle/src/schema/features`

Not every feature needs all three layers, but new product-facing features should
be designed as one cohesive unit instead of scattered edits across unrelated
folders.

## Feature types

### Page feature

Use a page feature when the feature owns one or more routes.

- User app path: `apps/features-app/src/features/{name}/`
- Optional admin path: `apps/feature-admin/src/features/{name}/`
- Server path: `packages/features-server/features/{name}/`
- Schema path: `packages/drizzle/src/schema/features/{name}/`

Typical client structure:

```text
apps/features-app/src/features/{name}/
├── index.ts
├── routes/
├── pages/
├── components/
├── hooks/
├── types/
└── locales/          # optional
```

### Widget feature

Use a widget feature when the UI is embedded inside other features instead of
owning a route.

- Widget UI path: `packages/widgets/src/{name}/`
- Server path: `packages/features-server/features/{name}/`
- Schema path: `packages/drizzle/src/schema/features/{name}/`

Read `widget.md` for the widget-specific rules.

### Agent feature

Use an agent feature when the feature also needs streaming or tool-driven
behavior in `apps/agent-server/src`.

- Client routes and UI still live under `apps/features-app/src/features/{name}/`
- Main server code still lives under `packages/features-server/features/{name}/`
- Agent-specific routes or services may also live under `apps/agent-server/src`

Keep the normal feature boundaries even when an agent server is involved.

## Server structure

Prefer this structure for new feature server code:

```text
packages/features-server/features/{name}/
├── index.ts
├── {name}.module.ts
├── controller/
├── service/          # or services/ if the feature already uses that style
├── trpc/
├── types/
└── dto/              # optional
```

Follow the existing style inside an established feature. Do not rename a mature
feature's internal folders just to match a new preference.

## Client structure

Use route factories instead of hard-coded central route objects.

- Public routes: `create{Name}Routes`
- Auth-only routes: `create{Name}AuthRoutes`
- Admin routes: `create{Name}AdminRoutes`

Expose the public surface from the feature `index.ts`. Keep deep internal files
private unless another module truly needs them.

## Legacy path note

Some tooling and comments in this repository still mention older Atlas paths such
as `apps/app` or `packages/features`. For implementation decisions, follow the
current live paths in this rule file unless you are explicitly repairing tooling.
