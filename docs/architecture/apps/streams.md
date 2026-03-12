# Streams

## Role

`apps/streams` currently exists as a package placeholder rather than as a
developed application surface.

At the time of analysis it contains only a minimal `package.json` and no active
runtime, route tree, worker entrypoint, or UI implementation.

## What this means architecturally

The directory is still useful to document because it signals one of two likely
states:

- a planned future runtime surface that has not been built out yet
- a reserved workspace slot kept for later extraction or experimentation

In both cases it should not be read as an active subsystem in the same sense as
`apps/api`, `apps/web`, or `apps/features-server`.

## Boundaries

- no confirmed framework wiring
- no current service entrypoint
- no visible coupling to auth, DB, agent, or sync layers

## How to think about it

For current architecture understanding, treat `apps/streams` as non-operational
scaffolding.

If it becomes populated later, it will need its own runtime and dependency
analysis before being considered part of the active system map.
