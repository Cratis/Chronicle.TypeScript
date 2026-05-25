# Chronicle TypeScript Client Documentation

Welcome to the Chronicle TypeScript client documentation.

## Overview

`@cratis/chronicle` is a TypeScript-idiomatic client for the Cratis Chronicle event-sourcing kernel. It builds on top of the [`@cratis/chronicle.contracts`](https://www.npmjs.com/package/@cratis/chronicle.contracts) gRPC contracts package and provides a clean, type-safe API for:

- Appending events to event sequences
- Managing event stores and namespaces
- Defining reactors, reducers, seeders, projections, constraints, and model-bound read models using TypeScript decorators such as `@readModel` and `@fromEvent`

## Guides

- [Getting Started](./getting-started.md) — Install and connect to Chronicle
- [Event Types](./event-types.md) — Defining event types with the `@eventType` decorator
- [Event Type Migrations](./event-type-migrations.md) — Defining generation migrations with `@eventTypeMigration`
- [Event Log](./event-log.md) — Appending events and querying the event log
- [Reactors](./reactors.md) — Reacting to events with the `@reactor` decorator
- [Reducers](./reducers.md) — Folding events into state with the `@reducer` decorator
- [Jobs](./jobs.md) — Managing Chronicle jobs from an event store
- [Webhooks](./webhooks.md) — Registering and discovering client webhooks
- [Seeding](./seeding.md) — Seeding initial events with the `@seeder` decorator
- [Identity](./identity.md) — Tracking who caused a state change
- [Auditing — Causation](./auditing.md) — Recording the causation chain for events
- [Correlation](./correlation.md) — Correlating events and operations with a shared identifier
- [Transactions (Unit of Work)](./transactions.md) — Group appends and commit or roll back as one unit
