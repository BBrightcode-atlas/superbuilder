---
description: Drizzle schema rules for feature-local schema folders.
globs: "packages/drizzle/src/schema/features/**/*.ts"
alwaysApply: false
---

# Feature Schema Rules

## Scope

These rules apply only to feature schema files under
`packages/drizzle/src/schema/features/**`.

If a feature schema touches authenticated user ownership or membership concepts,
also read `auth.md` before choosing table references.

## Naming

For new feature schema work:

- use a stable feature prefix in table and enum names
- prefer `feature_table_name` style table names
- prefer `feature_enum_name` style enum names
- keep TypeScript identifiers in `camelCase`

Examples:

- `board_boards`
- `board_posts`
- `story_studio_projects`

If you are editing an established feature that already uses a naming pattern,
preserve that feature's existing prefix instead of mixing styles.

## File layout

Prefer this order inside a schema file:

1. enums
2. JSON types
3. table definitions
4. relations if needed
5. inferred type exports

## Column helpers

Use shared helpers from `packages/drizzle/src/utils` when they fit:

- `baseColumns()`
- `baseColumnsWithSoftDelete()`
- other shared timestamp or soft-delete helpers already used in the repository

## JSONB rules

Type JSONB columns with `.$type<T>()` whenever the shape is known.

```ts
type FeatureSettings = {
  enabled?: boolean;
  labels?: string[];
};

settings: jsonb("settings").$type<FeatureSettings>().default({})
```

## Foreign keys

- prefer references to core tables such as profiles and files
- avoid cross-feature foreign keys unless the dependency is fundamental
- if cross-feature linkage is unavoidable, keep the dependency one-way and document it

## Auth-related ownership

Do not invent feature-local auth tables or session tables.

When a feature needs user ownership or auth-linked references:

- follow the active centralized auth contract from `packages/drizzle/src/schema/core/auth.ts`
- avoid spreading new long-term coupling to legacy auth-era tables
- keep temporary compatibility choices easy to migrate later

## Shared registration

After adding a new feature schema folder, re-export it from:

- `packages/drizzle/src/schema/index.ts`

Do not manually edit generated migration output. Change schema source files only.
