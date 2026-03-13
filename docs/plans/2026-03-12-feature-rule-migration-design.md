# Feature Rule Migration Design

## Goal

Migrate the useful feature implementation rules from `BBrightcodeDev/feature-atlas`
into this repository without importing Atlas-wide assumptions. The migrated rules
must apply only when working on feature implementation paths.

## Scope

This design introduces a new `.claude/rules/feature/` rule set that is limited to:

- `apps/features-app/src/features/**`
- `apps/feature-admin/src/features/**`
- `packages/features-server/features/**`
- `packages/widgets/src/**`
- `packages/drizzle/src/schema/features/**`

The migration is intentionally limited to feature implementation guidance. It does
not add global frontend, backend, or Cursor-specific rule sets.

## Design

The rule set is split by concern instead of keeping one large file:

- `README.md` as the entry point and path map
- `definition.md` for feature types and directory structure
- `dependencies.md` for import and export boundaries
- `isolation.md` for cross-feature safety rules
- `schema.md` for feature schema conventions
- `steps.md` for the implementation workflow and registration checklist
- `widget.md` for embedded widget features in `packages/widgets`

The content is based on the original Atlas rules, but all paths and package names
are translated to the current repository conventions such as
`@superbuilder/features-server`, `@superbuilder/features-client`,
`apps/features-app`, and `packages/features-server/features`.

## Constraints

- Do not modify unrelated user changes in the working tree.
- Do not invent new global rules outside feature implementation scope.
- Prefer current repository reality over old Atlas path assumptions when they differ.

## Acceptance

After the change:

- `.claude/rules/feature/` exists with feature-only rule files
- each rule is scoped with feature-only globs
- the rules reference current repository paths instead of old Atlas defaults
- no existing non-feature rule configuration is broadened
