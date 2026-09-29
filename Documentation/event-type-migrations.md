---
title: Event type migrations
description: Event type migrations are documented in the shared Chronicle docs, with TypeScript examples.
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
