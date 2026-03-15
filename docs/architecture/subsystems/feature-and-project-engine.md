# Feature and Project Engine

## Role

This subsystem is the core of the superbuilder platform's move from a Superset
fork toward a full feature-composition system.

Its job is not only to render existing features. It defines how features are
discovered from `superbuilder-features`, resolved for dependencies, scaffolded
into new projects, and deployed through the pipeline.

## 3-Repo context

Feature code does **not** live in this repo. The engine operates across three
repos:

| Repo | Engine's relationship |
|------|----------------------|
| `superbuilder` (this repo) | Houses `atlas-engine`, Desktop orchestration, registry scan |
| `superbuilder-features` | Source of all feature code; scanned via `feature.json` manifests |
| `superbuilder-app-boilerplate` | Scaffold target; receives feature code at `[ATLAS:*]` markers |

## Why it matters

The long-term product direction is a combined toolchain that can move from code
and workspace context into reusable feature units, and from those feature units
into larger project surfaces. The engine is what makes that pipeline executable.

## Main libraries and runtime pieces

- `feature.json` manifests as the source of truth for every feature
- `atlas-engine` for scan, resolve, scaffold, and pipeline
- Desktop Atlas routers for orchestration and UI
- Neon DB + tRPC for Feature Studio state management
- GitHub + Vercel + Neon integrations for deployment pipeline

## Key code locations

### Feature registry and scaffold tooling (`packages/atlas-engine`)

```
packages/atlas-engine/src/
  manifest/     — scanFeatureManifests(), manifestsToRegistry(), fetchRemoteManifest()
  resolver/     — dependency resolution, topological sort
  connection/   — deriveConnections(), applyConnections(), insertAtMarker()
  transform/    — transformImports() (@superbuilder/* → @repo/*)
  scaffold/     — scaffold(), registerToBoilerplate(), path resolution
  pipeline/     — composePipeline() (scaffold + Neon + GitHub + Vercel + seed)
```

The engine reads `feature.json` files from a local clone of `superbuilder-features`
(or via `fetchRemoteManifest()` for remote lookup).

### Desktop Atlas routers (`apps/desktop/src/lib/trpc/routers/atlas/`)

```
registry.ts          — scanFeatureManifests → manifestsToRegistry
resolver.ts          — dependency resolution thin wrapper
composer.ts          — composePipeline() thin wrapper
feature-studio.ts    — Feature Studio workflow orchestration
deployments.ts       — deployment status and management
vercel.ts / neon.ts  — Vercel and Neon integration helpers
```

### Feature Studio data layer

Feature Studio (the feature creation and approval workflow) is backed by the
superbuilder Neon DB:

- Schema: `packages/db/src/schema/feature-studio.ts`
- tRPC Router: `packages/trpc/src/router/feature-studio/`
- Desktop proxy: `apps/desktop/src/lib/trpc/routers/atlas/feature-studio.ts`

The desktop client accesses Feature Studio through `apps/api` at `/api/trpc`
using the `@superset/trpc` AppRouter.

### Feature code in `superbuilder-features`

Each feature lives at `superbuilder-features/features/{name}/` and contains:

```
features/{name}/
  feature.json     — manifest: id, name, deps, provides, tags
  server/          — NestJS/tRPC server module
  client/          — React pages and hooks
  schema/          — Drizzle DB schema
  ui/              — feature-specific UI components
```

`scanFeatureManifests(featuresDir)` walks this tree and produces
`FeatureManifest[]`. `manifestsToRegistry()` converts those to a `FeatureRegistry`
used by the resolver and scaffold pipeline.

## Feature lifecycle

1. **Discover** — `scanFeatureManifests(featuresDir)` → `FeatureManifest[]`
2. **Resolve** — dependency resolution + topological sort
3. **Studio** — spec/plan generation → approval workflow (Feature Studio)
4. **Scaffold** — `scaffold()` clones `superbuilder-app-boilerplate`, copies
   selected feature code from `superbuilder-features`, transforms imports,
   inserts `[ATLAS:*]` marker blocks
5. **Deploy** — `composePipeline()` → Neon DB + GitHub repo + Vercel
   (app + admin + landing + server) + seed

## Structural pattern

The engine operates across four layers:

1. **Source analysis** — manifest scanning and registry generation
2. **Resolution** — dependency graph and topological ordering
3. **Scaffold** — template clone + feature copy + import transform + connection insert
4. **Pipeline** — full deployment orchestration (Neon, GitHub, Vercel, seed)

This is why the system feels like a tool for composing capabilities rather than
only a normal multi-app product.

## Legacy references (삭제됨)

> **Legacy (삭제됨):** Earlier versions of this document referenced code
> locations that no longer exist in the current 3-repo architecture.

| Deleted location | What replaced it |
|-----------------|-----------------|
| `packages/features-server/features/feature-catalog/` | `scanFeatureManifests()` in `atlas-engine` reading `superbuilder-features` |
| `packages/features-cli/src/commands/` | `atlas-engine` scaffold + pipeline; Desktop Atlas routers |
| `packages/atlas-engine/src/registry/` `extractor/` | `packages/atlas-engine/src/manifest/` (current module layout) |
| `apps/features-app/src/features/` | `superbuilder-app-boilerplate/apps/app/` (post-scaffold) |
| `apps/feature-admin/src/features/` | `superbuilder-app-boilerplate/apps/admin/` (post-scaffold) |

## Connected subsystems

- [Workspace and Code Context](./workspace-and-code-context.md)
- [Tasks System](./tasks-system.md)
- [Auth and Organization Model](./auth-and-organization-model.md)
- [Feature Lifecycle](./feature-lifecycle.md)
- [Composer → Scaffold Pipeline](./composer-scaffold-pipeline.md)
- [Feature JSON Schema](./feature-json-schema.md)
- [Marker Reference](./marker-reference.md)
