# Features Server

## Role

`apps/features-server` is the main backend application for the superbuilder
feature and project layer.

It is the operational host for the `@superbuilder/features-server` package and
turns those exported feature modules into a running HTTP backend.

Architecturally, this is one of the key services that turns the repository from
"an app fork" into "a combined system for code, features, and projects."

## Runtime and framework

- NestJS
- Fastify adapter
- tRPC mounted alongside REST endpoints
- Swagger/OpenAPI exposure
- Drizzle-backed database access
- PostHog and OpenTelemetry server instrumentation

## Internal structure

The app itself is intentionally thin.

Its main responsibilities are:

- bootstrapping NestJS
- loading environment variables
- enabling validation, CORS, and security middleware
- exposing Swagger docs
- mounting tRPC transport
- converting auth headers into request context
- importing all feature modules in the app module

Most feature behavior lives in `packages/features-server/features/*`, not in the
app wrapper.

Note: Feature Studio has been migrated out of this app into the Superset-derived
foundation. Its schema now lives in `packages/db/src/schema/feature-studio.ts`
and its tRPC router in `packages/trpc/src/router/feature-studio/`, served
through `apps/api` at `/api/trpc`.

## Architectural role in the whole system

This app is best understood as a composition host:

- the app bootstraps the runtime
- the package namespace `@superbuilder/features-server` provides the feature logic
- `apps/feature-admin` and `apps/features-app` consume the resulting APIs
- feature definitions can be elevated into broader project-building flows from here

## Important distinction

This is not the same backend as `apps/api`.

Today the repository still has two backend centers:

- `apps/api` as part of the Superset-derived foundation
- `apps/features-server` as the newer feature and project backend

That split should be read as an evolution stage of one larger system, not as the
final target shape.
