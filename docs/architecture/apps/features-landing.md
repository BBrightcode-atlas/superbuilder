# Features Landing

## Role

`apps/features-landing/landing` is the public-facing landing and template
surface for the `@superbuilder/*` feature and project layer.

It is separate from the main `apps/marketing` site. Its role is narrower: it
packages reusable landing-page templates and preview flows that sit closer to
the feature creation workflow than to the broader product brand surface.

## Runtime shape

- framework: Next.js
- package name: `@superbuilder/features-landing`
- UI basis: React 19 + Tailwind CSS v4
- shared UI dependency: `@superbuilder/feature-ui`

This is a thin presentation app rather than a business-logic-heavy system. The
app is structured around template registries, preview routes, and site config.

## Internal structure

The app is organized around a small set of responsibilities:

- app router entrypoints for the public page, preview flows, and changelog views
- a template registry that selects between multiple landing-page compositions
- template folders for prebuilt variants such as startup, SaaS, and agency
- a lightweight component layer for shared shell elements like navbar and footer

This makes it closer to a showcase/template delivery surface than to a full
application.

## Dependencies and boundaries

This app depends on `@superbuilder/feature-ui` for shared feature-layer UI
primitives and styling conventions.

It does not appear to be the main place where auth, data persistence, or agent
execution happens. Those concerns live elsewhere in the monorepo.

## How to think about it

Treat this app as the public presentation edge of the feature and project layer:

- `apps/marketing` explains the broader product and company-facing story
- `apps/features-landing/landing` showcases or previews feature-system landing
  experiences
- `apps/features-app` is the authenticated or operational feature application

That distinction matters because the three surfaces may look similar in
technology but serve different audiences and lifecycle stages.
