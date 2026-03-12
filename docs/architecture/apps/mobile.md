# Mobile App

## Role

`apps/mobile` is the React Native and Expo mobile surface for the
Superset-derived foundation of the superbuilder system.

It appears to be a native client for authenticated product experiences rather
than a marketing or documentation shell.

## Runtime and framework

- Expo / React Native
- Expo Router
- Better Auth Expo support
- TanStack Query
- tRPC client
- Electric SQL client pieces
- PostHog React Native

## Internal structure

The app uses route groups such as:

- `(auth)`
- `(authenticated)`

That indicates a clear authenticated versus unauthenticated flow model, similar
to the web stack but adapted to mobile navigation patterns.

## Dependencies

The mobile app depends on the current foundation packages:

- `@superset/db`
- `@superset/trpc`

It also uses mobile-native primitives and Expo modules for secure storage,
linking, device APIs, file access, and browser handoffs.

## Architectural role in the whole system

This app extends the current core product surface onto mobile devices.

It shares auth, data, and typed API contracts with the web and likely desktop
surfaces, but uses a mobile-first navigation and UI layer.
