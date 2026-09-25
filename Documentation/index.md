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

The TypeScript examples on those pages are compiled with legacy decorators (`experimentalDecorators`), which proves they type-check, not that they run. Many declare event properties as constructor parameters, such as `constructor(readonly name: string)`. In 6.7.1 such events register without their properties unless each parameter has a default value, so rewrite them with `@field(Type)` when you copy them, as described in [Decorator mode and schema types](./getting-started.md#decorator-mode-and-schema-types).

## TypeScript-specific pages

- [Connect to Chronicle](./connecting.md) — connection strings, credentials, TLS, reconnection, compatibility, and shutdown
- [Preserve existing append routes](./migrate-append-routing.md) — keep writing to existing streams after the append-routing change
- [Sinks](./sinks.md) — choose where read models are stored
- [Jobs](./jobs.md) — inspect and control Chronicle jobs
- [Webhooks](./webhooks.md) — register webhooks in code or with decorators
- [External Services](./external-services.md) — register HTTP and database services in code
- [Seeding](./seeding.md) — seed events with `@seeder` classes
- [Identity](./identity.md), [Causation](./auditing.md), and [Correlation](./correlation.md) — the metadata the client attaches to every append
- [Failed Partitions](./failed-partitions.md) — find observers that stopped processing an event source

## Known limitations in 6.7.1

- With legacy decorators, an event whose properties are constructor parameters without default values registers with an empty schema, so projections cannot map its data. Use `@field(Type)` fields or give each parameter a default value.
- Read-model queries such as `findInstanceById` only fill properties declared with `@field(Type)`. Other properties come back with their default values, even though the stored read model contains them.
- `@setValue(Event, value)` and the declarative `.set(...).toValue(value)` do not write the constant to the read model. Until this is fixed, map the value from an event property with `@setFrom` or `.to(...)`, or compute it with a [reducer](/chronicle/reducers/).
- A process that registered a reactor can keep running after `client.dispose()`.
- Default artifact discovery needs the `glob` package, which is not installed with the client, and its `!` exclusion patterns have no effect. See [Artifact discovery](./getting-started.md#artifact-discovery).
