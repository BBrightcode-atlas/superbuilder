# Electric Proxy

## Role

`apps/electric-proxy` is a focused sync gateway in front of Electric SQL.

Its job is to authorize a sync request, reduce what data a client can see, and
forward a constrained query upstream.

## Runtime and framework

- Cloudflare Worker style runtime
- JWT verification
- Electric SQL proxying
- CORS handling for browser/mobile/desktop sync clients

## Internal structure

The proxy is deliberately small and policy-driven.

It handles:

- bearer token validation
- organization membership checks
- table-level request validation
- filter generation for the upstream Electric endpoint
- safe response passthrough with CORS normalization

## Architectural role in the whole system

It protects synced data access by ensuring clients only subscribe to tables and
organizations they are entitled to see.

This app matters because Electric-style sync is otherwise far too open if placed
directly in front of clients.
