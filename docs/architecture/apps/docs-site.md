# Docs Site

## Role

`apps/docs` is the dedicated documentation site for the Superset-derived
foundation and the broader superbuilder system.

Its goal is to publish product and developer documentation in a navigable,
searchable form, separate from the marketing site and separate from repository
internal notes.

## Runtime and framework

- Next.js App Router
- Fumadocs for content and layout generation
- MDX-based documentation authoring
- search endpoint support
- PostHog and Sentry instrumentation

## Internal structure

The app is centered on a docs route group and a generated content source.

Key elements:

- docs page layout
- sidebar and navigation components
- API search route
- LLM-oriented outputs such as `llms-full.txt`
- OG image routes for documentation pages

## Dependencies

The docs app uses a lighter shared surface than the product apps:

- `@superset/shared`
- Fumadocs packages
- browser-side analytics and instrumentation

It is more of a publishing application than an application business client.

## Architectural role in the whole system

The docs site is the formal public knowledge surface, while the repository’s
`docs/` folder holds internal engineering notes, plans, and this architecture
map.
