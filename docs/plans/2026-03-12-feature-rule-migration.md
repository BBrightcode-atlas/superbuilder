# Feature Rule Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a feature-only `.claude/rules/feature/` rule set migrated from the
Feature Atlas source repository and translated to this repository's actual paths.

**Architecture:** Create a small, path-scoped rule pack instead of importing the
full Atlas `.claude` tree. Keep rule concerns separated so future changes to
feature structure, schema, or registration points can be updated independently.

**Tech Stack:** Claude rules markdown, Bun monorepo, React feature apps, NestJS
feature server, Drizzle schema folders.

---

### Task 1: Capture the migration context

**Files:**
- Create: `docs/plans/2026-03-12-feature-rule-migration-design.md`
- Create: `docs/plans/2026-03-12-feature-rule-migration.md`

**Step 1: Record the approved design**

Write down the scope, target paths, and non-goals so future edits do not expand
the rule set beyond feature work.

**Step 2: Save the implementation plan**

Store this plan under `docs/plans/` so the migration stays discoverable.

### Task 2: Add the feature rule entry point

**Files:**
- Create: `.claude/rules/feature/README.md`

**Step 1: Define the scope**

Document the exact feature paths where these rules apply.

**Step 2: Define the rule graph**

List which supporting rule files to read for definition, dependencies, schema,
workflow, and widget behavior.

### Task 3: Add structure and boundary rules

**Files:**
- Create: `.claude/rules/feature/definition.md`
- Create: `.claude/rules/feature/dependencies.md`
- Create: `.claude/rules/feature/isolation.md`

**Step 1: Write the feature type rules**

Describe page, widget, and agent feature types using current repository paths.

**Step 2: Write import and export rules**

Lock down public import patterns and ban cross-feature deep imports.

**Step 3: Write isolation rules**

Allow edits in the active feature and shared registration files only.

### Task 4: Add schema and workflow rules

**Files:**
- Create: `.claude/rules/feature/schema.md`
- Create: `.claude/rules/feature/steps.md`
- Create: `.claude/rules/feature/widget.md`

**Step 1: Write schema rules**

Document feature-local Drizzle schema conventions and exceptions for legacy code.

**Step 2: Write the implementation checklist**

List the current registration files that must be updated for a new feature to work.

**Step 3: Write the widget rules**

Capture the `packages/widgets` pattern for embedded connected components.

### Task 5: Verify the migration

**Files:**
- Verify: `.claude/rules/feature/*.md`

**Step 1: Read the generated files**

Make sure all paths point at the current repository structure and not the old
Atlas defaults.

**Step 2: Check git status**

Confirm only the intended new rule files and plan docs were added.

**Step 3: Summarize residual risk**

Call out that Cursor-format rule parity was intentionally not added in this pass.
