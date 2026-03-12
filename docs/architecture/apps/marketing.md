# Marketing App

## Role

`apps/marketing` is the public-facing acquisition, brand, and content site.

It exists to explain the product, publish content, drive downloads or signups,
and support SEO-oriented discovery surfaces.

## Runtime and framework

- Next.js App Router
- React 19
- Tailwind-based design system usage
- MDX/content-driven pages
- animation and visual layers with Framer Motion and Three.js
- PostHog and Sentry instrumentation

## Main content areas

The route structure shows a classic product-marketing composition:

- landing page
- blog
- changelog
- compare pages
- team pages
- legal pages
- community and waitlist surfaces
- machine-readable LLM and feed outputs

## Internal structure

The app is organized around reusable marketing blocks rather than data-heavy
application state.

Examples of architectural building blocks:

- hero and CTA sections
- feature demonstration sections
- blog and changelog layouts
- waitlist and download actions
- comparison page generators

## Dependencies

The app mainly uses:

- `@superset/ui`
- `@superset/shared`
- `@superset/auth` for the edges where product auth needs to connect

Compared with the web app, it is much more content- and presentation-oriented.

## Architectural role in the whole system

This app is the top of the funnel.

It brings users into the ecosystem, while `apps/web` and `apps/desktop` handle
the actual product experience.
