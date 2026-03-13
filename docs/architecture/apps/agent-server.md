# Agent Server

## Role

`apps/agent-server` is the AI and streaming backend for the superbuilder feature
and project layer.

It complements `apps/features-server` rather than replacing it. Where
`apps/features-server` provides the main feature backend, `apps/agent-server`
provides model routing, streaming chat, tool invocation, and agent-oriented
services.

## Runtime and framework

- Hono
- tRPC for typed endpoints inside the service
- AI SDK providers for Anthropic, OpenAI, and Google
- feature-stack database access
- Supabase-era auth helpers still present in the current implementation

## Internal structure

The service is organized into:

- environment and DB wiring
- auth and credit helpers
- model provider registry
- runtime context builders
- routes for streaming chat
- services for threads, messages, usage, and agents
- tool registries for feature actions

This structure makes it closer to an AI runtime host than a generic REST API.

## Architectural role in the whole system

It serves the feature-system AI layer:

- `apps/features-app` can use it for agent-centric UX
- feature tools expose domain actions into the AI runtime
- provider and tool registries coordinate model execution

## Important distinction

This app overlaps conceptually with the agent-oriented capabilities in the
Superset-derived foundation, but it belongs to the `@superbuilder/*` layer and
still has its own conventions and migration path.
