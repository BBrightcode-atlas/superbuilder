---
description: Feature implementation guide for the migrated Atlas feature workflow.
globs: "apps/features-app/src/features/**/*,apps/feature-admin/src/features/**/*,packages/features-server/features/**/*,packages/widgets/src/**/*,packages/drizzle/src/schema/features/**/*"
alwaysApply: false
---

# Feature Development Rules

Read this rule set when creating or modifying a feature. These rules are scoped
to feature implementation paths only and should not be treated as global
repository rules.

## Current path map

- User-facing feature pages: `apps/features-app/src/features/{name}/`
- Admin feature pages: `apps/feature-admin/src/features/{name}/`
- Feature server code: `packages/features-server/features/{name}/`
- Embedded widgets: `packages/widgets/src/{name}/`
- Feature schema: `packages/drizzle/src/schema/features/{name}/`

## Rule files

- `definition.md`: feature types and folder structure
- `dependencies.md`: import and export boundaries
- `isolation.md`: cross-feature edit limits
- `auth.md`: auth/session/role migration guardrails for feature work
- `schema.md`: Drizzle schema rules for feature folders
- `steps.md`: build order and registration checklist
- `widget.md`: widget-specific client rules

## Workflow

1. Classify the feature as page, widget, or agent.
2. Read `definition.md` for the correct folder layout.
3. Read `dependencies.md` and `isolation.md` before editing imports or touching
   shared files.
4. If the feature touches auth, session, organization membership, or admin
   checks, read `auth.md`.
5. Read `schema.md` before editing `packages/drizzle/src/schema/features/**`.
6. Follow `steps.md` to create files and register the feature in shared entry
   points.

## Critical rules

- Prefer current repository paths over old Atlas examples when they disagree.
- Keep client, server, widget, and schema responsibilities separated.
- Do not modify unrelated feature folders just to wire in a new feature.
- Shared registration files are the only allowed cross-feature touch points.
- If auth is involved, follow the migration-safe rules in `auth.md` instead of
  copying old Supabase-era patterns.
- If the work is a widget feature, also read `widget.md`.
