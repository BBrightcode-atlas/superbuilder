# Feature Admin

## Role

`apps/feature-admin` is the admin and operator interface for the superbuilder
feature and project layer.

It is not the same thing as the main `apps/admin` application. It exists to
manage the `@superbuilder/*` feature ecosystem, its content, and the operational
side of turning features into maintainable project assets.

## Runtime and framework

- Vite
- React 19
- TanStack Router
- TanStack Query
- Jotai
- feature-specific UI package
- feature-specific shared widgets

## Internal structure

The app is organized around:

- `src/features/*` admin modules
- an admin layout
- a feature menu configuration file
- a route registration file that composes feature admin route factories

This reveals a modular admin model where each feature can opt into admin routes
and sidebar registration.

## Architectural role in the whole system

This app is the operations surface for the feature and project layer.

It works with:

- `apps/features-server` as the backend
- `packages/features-server` as the feature contract surface
- `@superbuilder/feature-ui` as the admin presentation layer

## Important distinction

Do not confuse this app with `apps/admin`. Both are “admin” apps, but they
serve different stacks and different architectural centers.
