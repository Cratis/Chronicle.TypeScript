# Chronicle TypeScript Client Documentation

Welcome to the Chronicle TypeScript client documentation.

## Overview

`@cratis/chronicle` is a TypeScript-idiomatic client for the Cratis Chronicle event-sourcing kernel. It builds on top of the [`@cratis/chronicle.contracts`](https://www.npmjs.com/package/@cratis/chronicle.contracts) gRPC contracts package and provides a clean, type-safe API for:

- Appending events to event sequences
- Managing event stores and namespaces
- Defining reactors, reducers, projections, and constraints using TypeScript decorators

## Guides

- [Getting Started](./getting-started.md) — Install and connect to Chronicle
- [Event Types](./event-types.md) — Defining event types with the `@eventType` decorator
- [Event Log](./event-log.md) — Appending events and querying the event log
- [Reactors](./reactors.md) — Reacting to events with the `@reactor` decorator
- [Reducers](./reducers.md) — Folding events into state with the `@reducer` decorator
