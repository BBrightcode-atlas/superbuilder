# Features App

## Role

`apps/features-app` is the primary client app for the superbuilder feature
workflow.

It is where the repository's feature-centric model becomes visible to end users:
feature surfaces, feature management flows, and feature-driven project-building
paths all converge here.

It is not just an unrelated extra app. It is part of the system that sits
between raw code context and higher-level project composition.

## Runtime and framework

- Vite
- React 19
- TanStack Router
- TanStack Query
- Jotai
- tRPC client
- feature-specific UI from `@superbuilder/feature-ui`
- connected widgets from `@superbuilder/widgets`

## Internal structure

The app is organized explicitly around `src/features/*`.

That structure makes feature folders the main unit of composition, with:

- routes
- pages
- hooks
- feature-local components
- feature-local types

It also has:

- a route tree entry point
- app layouts
- feature-local i18n setup
- shared Supabase-auth-oriented client wiring inherited from the feature stack

## Notable responsibilities

The route map suggests it supports:

- community and board surfaces
- payments, plans, and bookings
- content and story studio flows
- feature catalog and task flows
- AI image and agent desk capabilities

## Architectural role in the whole system

This app is the user-facing browser client for the feature and project layer.

It pairs with:

- `apps/features-server` for the main feature backend
- `apps/agent-server` for AI/streaming behaviors
- `apps/feature-admin` for admin surfaces

## Important distinction

This app is separate from `apps/web`, but the intended direction is not to keep
two unrelated browser products forever.

Instead, `apps/web` reflects more of the Superset-derived base, while
`apps/features-app` reflects the superbuilder feature workflow that is meant to
shape how the broader system evolves.
