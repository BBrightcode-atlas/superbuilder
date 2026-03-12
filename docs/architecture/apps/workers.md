# Workers

## Role

`apps/workers` is a small standalone tooling area for remote-control and
automation services.

It does not look like a normal product app. It is more of an operational utility
bundle for CDP-based remote browser or IDE control and webhook-driven automation.

## Runtime and framework

- Node scripts
- WebSocket support
- standalone launchers and webhook handlers

## Internal structure

The app contains:

- a CDP server
- a launcher for orchestrating multiple remote-control instances
- a client script
- a Linear webhook handler
- a general server wrapper

## Architectural role in the whole system

This app appears to support remote automation and operator workflows rather than
direct end-user product paths. It belongs to the broader agent and orchestration
story of the repository.
