# Build and Runtime Architecture

## Monorepo orchestration

The repository uses:

- Bun as package manager and script runner
- Turborepo for workspace orchestration
- shared TypeScript config under `tooling/typescript`
- Biome at the repository root for formatting and linting

This is a package-first monorepo where most build logic is centralized at the
root and delegated to individual apps and packages.

## Turbo model

Turborepo defines:

- `build`
- `dev`
- `test`
- `typecheck`
- `lint`
- DB-related tasks

The root task graph makes app/package boundaries explicit and allows different
surfaces to be developed independently while still sharing cache behavior.

## Environment model

The runtime environment is strongly environment-variable driven.

Examples of shared concerns in the turbo config:

- database URLs
- product URLs for web, marketing, docs, admin, API, and Electric
- analytics credentials
- KV and blob storage credentials

The repository is therefore designed to run as a coordinated suite of services
rather than one isolated app.

## Runtime families

### Next.js applications

- `apps/web`
- `apps/api`
- `apps/admin`
- `apps/marketing`
- `apps/docs`

These use Next.js 16 App Router and share common instrumentation patterns.

### Electron application

- `apps/desktop`

This has its own main/preload/renderer build pipeline and native packaging path.

### React Native application

- `apps/mobile`

This uses Expo and an entirely different runtime distribution path.

### Service applications

- `apps/electric-proxy` as worker-style proxy
- `packages/workspace-service` as a Hono + tRPC service

> **Legacy (삭제됨):** `apps/features-server` (NestJS/Fastify) and
> `apps/agent-server` (Hono) have been deleted. Feature server modules now live
> in `superbuilder-features/features/*/server/`. Agent runtime is handled by
> the Mastra-based runtime inside the Desktop app.

## Development topology

Local development is not a single-port setup.

The repo is designed around multiple concurrent services, with Caddy and URL
routing used in development where needed. This reflects the fact that the system
contains several apps that must coexist:

- product UI
- API
- desktop support services
- docs and marketing surfaces
- sync layers
- feature-platform services

## Distribution model

The repository supports multiple delivery modes:

- web deployment for Next apps
- Electron packaging and release for desktop
- Expo/native build flows for mobile
- worker deployment for Electric proxy
- service hosting for Hono and NestJS apps

## Architectural consequence

This is not a monolith and not a simple collection of isolated apps either.

It is a coordinated runtime portfolio. The build system, environment model, and
service boundaries are designed to support a product that spans:

- browser
- desktop
- mobile
- background service
- sync proxy
- agent tooling
