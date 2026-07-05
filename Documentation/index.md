# Chronicle TypeScript Client

`@cratis/chronicle` is the TypeScript SDK for Chronicle. It builds on top of the [`@cratis/chronicle.contracts`](https://www.npmjs.com/package/@cratis/chronicle.contracts) gRPC contracts package and provides TypeScript APIs for event stores, event logs, observers, read models, jobs, sinks, and metadata.

Use this section for TypeScript installation, connection setup, decorators, generated APIs, and runtime integration details. Shared Chronicle concepts and workflows live in the main Chronicle docs and use language tabs when code differs by client.

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

## TypeScript-specific pages

- [Getting Started](./getting-started.md) — install and connect the TypeScript client
- [Sinks](./sinks.md) — configuring read-model persistence targets
- [Jobs](./jobs.md) — managing Chronicle jobs from TypeScript
- [Webhooks](./webhooks.md) — registering and discovering client webhooks
- [Identity](./identity.md), [Causation](./auditing.md), and [Correlation](./correlation.md) — TypeScript call-context metadata
