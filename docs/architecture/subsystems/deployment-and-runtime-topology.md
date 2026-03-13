# Deployment and Runtime Topology

## Role

This subsystem explains where the repository's surfaces actually run.

The repo is not deployed as one uniform application. It is a mixed topology of
desktop binaries, Next.js apps, serverless APIs, dedicated feature-stack
services, Fly-hosted Electric infrastructure, and a Cloudflare Worker proxy.

## Why it matters

A new engineer can read app folders and still miss the real runtime picture.

This topology document answers the practical questions:

- which surfaces are bundled into the desktop binary
- which surfaces are standard Next.js applications
- which services are Hono or Nest-based backends
- which pieces are serverless wrappers
- where Electric sync and proxy infrastructure run

## Main libraries and runtime pieces

- Bun workspaces and root script orchestration
- Turborepo for monorepo task execution
- Next.js 16 for web, API, marketing, admin, docs, and some feature surfaces
- Electron + Electron Vite + Electron Builder for desktop packaging
- Hono for lightweight service runtimes
- NestJS + Fastify for the feature-stack server
- Vercel function manifests for service-style app deployment
- Fly.io for Electric upstream hosting
- Cloudflare Workers for the Electric access proxy
- Sentry for runtime error collection across multiple surfaces

## Key code locations

### Root orchestration

- `package.json`

The root scripts define the default developer entrypoint and reveal the main
runtime grouping:

- `bun dev` focuses on `@superset/api`, `@superset/web`, `@superset/desktop`,
  and the local proxy layer
- `turbo` is the execution coordinator for build, test, and typecheck tasks
- Bun is the workspace package manager for the monorepo

### Desktop packaging

- `apps/desktop/package.json`
- `apps/desktop/electron-builder.ts`
- `apps/desktop/electron-builder.canary.ts`

Desktop is its own runtime class:

- Electron main and renderer bundles
- native module copying and runtime validation
- packaged release and canary flows
- embedded local services for terminals, workspace runtime, local DB, and MCP

### Next.js surfaces

- `apps/web/package.json`
- `apps/web/next.config.ts`
- `apps/api/package.json`
- `apps/api/next.config.ts`
- `apps/admin/package.json`
- `apps/admin/next.config.ts`
- `apps/marketing/package.json`
- `apps/marketing/next.config.ts`
- `apps/docs/package.json`
- `apps/docs/next.config.mjs`

These are the browser and server-rendered surfaces of the Superset-derived
platform. They use standard Next.js packaging with Sentry wrapping and
environment loading from the monorepo root during development.

### Feature-stack services

- `apps/features-server/package.json`
- `apps/features-server/src/main.ts`
- `apps/features-server/vercel.json`
- `apps/agent-server/package.json`
- `apps/agent-server/src/main.ts`
- `apps/agent-server/vercel.json`

This newer stack is deployed differently from the legacy Next.js API surface:

- `features-server` is a NestJS + Fastify application with both REST and tRPC
  surfaces
- `agent-server` is a Hono-based service with chat streaming and agent-oriented
  tRPC routes
- both include Vercel serverless manifests for `api/index.ts` style deployment

### Feature-stack frontends

- `apps/features-app/package.json`
- `apps/features-app/vercel.json`
- `apps/feature-admin/package.json`
- `apps/features-landing/landing/package.json`
- `apps/features-landing/landing/next.config.ts`

These are the superbuilder-facing UI runtimes:

- `features-app` is a Vite client
- `feature-admin` is a separate admin UI surface
- `features-landing` is a dedicated landing or distribution surface

### Electric deployment split

- `fly.toml`
- `apps/electric-proxy/package.json`
- `apps/electric-proxy/src/index.ts`
- `apps/electric-proxy/wrangler.jsonc`

Electric is deployed as two cooperating runtime layers:

- an upstream Electric service hosted on Fly
- a Cloudflare Worker that authenticates requests, scopes them to authorized
  organizations, and forwards them upstream

## Runtime shape

At a high level:

1. local development starts from the root Bun script layer and fans out through
   Turbo
2. the main Superset-derived product surfaces run as Next.js applications plus
   the desktop Electron app
3. the superbuilder feature stack adds a separate Vite client and service
   backends for feature and agent workflows
4. sync traffic goes through the Electric service on Fly and the Worker-based
   access proxy
5. Sentry and PostHog wrap multiple runtime classes rather than a single
   monolithic server

## Connected subsystems

- [Build and Runtime](../platform/build-and-runtime.md)
- [Desktop Agent Runtime](./desktop-agent-runtime.md)
- [Sync and Integrations](./sync-and-integrations.md)
- [Project and Workspace Operations](./project-and-workspace-operations.md)

## Current constraints

- namespace convergence is incomplete, so runtime naming still mixes
  `@superset/*` and `@superbuilder/*`
- the repository uses multiple deployment styles at once: desktop packaging,
  Next.js hosting, dedicated services, Workers, and Fly-hosted infrastructure
- the feature stack is modernizing runtime boundaries, but the legacy
  Superset-derived entrypoints still own much of the public product surface
