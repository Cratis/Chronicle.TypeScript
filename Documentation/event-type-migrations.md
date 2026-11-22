---
title: Event type migrations
description: Learn where event type migrations are documented and see TypeScript examples for evolving event schemas across generations without breaking old events.
sharedTopicBridge: true
---

Event type migrations are shared Chronicle behavior. The shared documentation owns the migration model and client-tabbed examples.

- [Event type migrations concept](/chronicle/concepts/event-type-migrations/)
- [Understanding event evolution](/chronicle/understanding-event-evolution/)
- [Migrations](/chronicle/migrations/)
- [TypeScript client setup](./getting-started.md)

## TypeScript client notes

- Declare each generation as its own class with the same id, for example `@eventType('author-registered', 1)` and `@eventType('author-registered', 2)`, and connect them with an `@eventTypeMigration(Newer, Older)` class that implements `upcast` and `downcast`. Register every generation and the migration before `getEventStore(...)`.
- The kernel rejects a newer generation that has no migration from the previous one, so `getEventStore(...)` fails instead of registering an incomplete chain.
- Events already stored at an older generation are migrated by the kernel when the newer generation is registered. Reading the event log with the newest class, kernel projections and reactors that catch up or replay all receive the newest shape, with the original event source and sequence number.
- Use `mapValues(targetProperty, sourceProperty, mappings)` with ordered `{ from, to }` pairs of JSON-serializable payload values. Numeric enums match their serialized numbers, not TypeScript member names. The kernel uses the first matching pair. In kernel 19.37.4, object values are compared as serialized JSON, so property order must match the payload. Unmapped values pass through unchanged; explicit `null` can be matched, while an absent source produces no result.
- Upcasts and downcasts are independent: configure either direction alone by leaving the other method empty. No inverse map is inferred. Mapping values can be strings, numbers, booleans, `null`, objects or arrays; `undefined`, functions and symbols are not JSON values.
- All property operations accept `MigrationPropertyPath<T>`, including nested paths such as `details.status` through optional or nullable objects, up to eight segments. Root keys remain valid for whole-property operations. Paths cannot index arrays or traverse array, `Date`, or function members. Paths use serialized payload names without naming-policy conversion.
