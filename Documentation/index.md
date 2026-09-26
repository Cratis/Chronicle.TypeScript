---
title: TypeScript client
description: Use Chronicle from Node.js and TypeScript with the @cratis/chronicle package — setup, connection, and TypeScript-specific APIs.
---

`@cratis/chronicle` lets a Node.js application written in TypeScript append events to Chronicle, build read models from them, and react to them, using decorated classes instead of hand-written gRPC calls. It builds on the [`@cratis/chronicle.contracts`](https://www.npmjs.com/package/@cratis/chronicle.contracts) gRPC contracts package.

This section covers what is specific to TypeScript: installation, TypeScript configuration, decorators, connection setup, and TypeScript-only APIs. Chronicle concepts and workflows are explained once in the shared Chronicle docs, which show TypeScript examples in their TypeScript tabs.

## Start here

[Get started with the TypeScript client](./getting-started.md) takes you from an empty folder to a program that appends events and reads the projected read model back. It also covers Node.js and TypeScript requirements, decorator modes, and the most common setup errors.

Then read [Connect to Chronicle](./connecting.md) before you point the client at anything other than a local development kernel. The client skips TLS certificate validation by default, and it retries a failing connection silently.

## Shared Chronicle topics

- [Get started](/chronicle/get-started/)
- [Events and event logs](/chronicle/events/)
- [Appending events](/chronicle/events/appending/)
- [Read models](/chronicle/read-models/)
- [Projections](/chronicle/projections/)
- [Reactors](/chronicle/reactors/)
- [Reducers](/chronicle/reducers/)
- [Constraints](/chronicle/constraints/)
- [Event seeding](/chronicle/event-seeding/)
- [Compliance](/chronicle/compliance/)
- [Transactions and unit of work](/chronicle/events/transactions/)
- [Event evolution](/chronicle/understanding-event-evolution/)

The TypeScript examples on those pages are compiled with legacy decorators (`experimentalDecorators`). Examples that declare event properties as constructor parameters, such as `constructor(readonly name: string)`, need legacy decorators. With standard decorators, declare the properties with `@field(Type)` instead, as described in [Decorator mode and schema types](./getting-started.md#decorator-mode-and-schema-types).

## TypeScript-specific pages

- [Connect to Chronicle](./connecting.md) — connection strings, credentials, TLS, reconnection, compatibility, and shutdown
- [Preserve existing append routes](./migrate-append-routing.md) — keep writing to existing streams after the append-routing change
- [Observers](./observers.md) — listing observers and removing one whose declaring code is gone
- [Sinks](./sinks.md) — choose where read models are stored
- [Jobs](./jobs.md) — inspect and control Chronicle jobs
- [Constraints](./constraints.md) — unique event properties and event types
- [Webhooks](./webhooks.md) — register webhooks in code or with decorators
- [External Services](./external-services.md) — register HTTP and database services in code
- [Seeding](./seeding.md) — seed events with `@seeder` classes
- [Identity](./identity.md), [Causation](./auditing.md), and [Correlation](./correlation.md) — the metadata the client attaches to every append
- [Failed Partitions](./failed-partitions.md) — find observers that stopped processing an event source

## Known limitations

- `AppendResult.waitForCompletion()` can time out when an observer on the event sequence does not handle the appended event. The kernel waits for every observer on the sequence ([Cratis/Chronicle#4132](https://github.com/Cratis/Chronicle/issues/4132)).
- With standard decorators, a model-bound read model whose mappings are all on properties registers only once an instance of it exists. Give it a class-level `@fromEvent(...)` decorator. See [Artifact discovery](./getting-started.md#artifact-discovery).
