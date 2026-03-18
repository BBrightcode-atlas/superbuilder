---
description: Rules for widget-style features implemented in packages/widgets.
globs: "packages/widgets/src/**/*"
alwaysApply: false
---

# Widget Feature Rules

Widgets are embedded feature UIs. They do not own top-level app routes.

## Path

- Widget UI: `packages/widgets/src/{name}/`
- Server logic: `packages/features-server/features/{name}/`
- Schema: `packages/drizzle/src/schema/features/{name}/`

## Preferred structure

```text
packages/widgets/src/{name}/
├── index.ts
├── {name}-section.tsx        # or primary connected entry component
├── components/
├── hooks/
├── store/                    # optional
└── types/                    # optional
```

## Rules

- Keep data access inside the widget package instead of pushing it into every caller.
- Use `@superbuilder/features-client/trpc-client` or the local client wrapper patterns
  already used by the widget package.
- Keep widget props generic and host-friendly, such as `targetType`, `targetId`,
  `className`, or well-scoped configuration props.
- Export the widget through `packages/widgets/src/{name}/index.ts` and register any
  new subpath export in `packages/widgets/package.json`.

## Consumption

Callers should import widgets from their package entry point, not deep internal files.

```ts
import { ReactionSection } from "@superbuilder/widgets/reaction";
```
