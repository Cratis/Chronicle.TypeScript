---
title: Transactions and unit of work
description: Where transactions are documented, the TypeScript unit-of-work result accessors, and append metadata in a unit of work.
sharedTopicBridge: true
---

Unit-of-work transactions are now documented as a shared Chronicle workflow with synchronized client examples.

- [Transactions and unit of work](/chronicle/events/transactions/)
- [Appending many events](/chronicle/events/appending-many/)
- [TypeScript client setup](./getting-started.md)

## TypeScript client notes

Alongside `unitOfWork.getAppendResults()` (the full per-event detail from the latest commit), `IUnitOfWork` exposes three purpose-built accessors — thin filters over the same append results, so you don't have to filter `getAppendResults()` yourself. This excerpt assumes a `unitOfWork` you started with `store.unitOfWorkManager.begin()`:

- `getConstraintViolations()` — every constraint violation across the commit.
- `getConcurrencyViolations()` — every concurrency violation across the commit.
- `getAppendErrors()` — every append error across the commit.

```typescript
await unitOfWork.commit();

const constraintViolations = unitOfWork.getConstraintViolations();
const concurrencyViolations = unitOfWork.getConcurrencyViolations();
const appendErrors = unitOfWork.getAppendErrors();
```

`transactional.append`, `transactional.appendMany` and `unitOfWork.addEvent` accept `namedTags` beside the event source routing options. Tags are validated when the event is added, so an invalid tag throws `InvalidNamedTag` before anything is committed.

A commit containing both non-empty named tags and any registered `eventSource` entry throws `NamedTagsWithRegisteredEventSourceNotSupported` before writing any event sequence, even when the tags and registered source are on different entries or sequences. The kernel's named-tag batch operation currently drops registered source routing ([kernel issue](https://github.com/Cratis/Chronicle/issues/4603)). Use single, non-transactional `append` calls for named tags with registered sources. Empty named-tag arrays and commits without registered sources remain supported.

### Append metadata in a unit of work

`transactional.append()` and `transactional.appendMany()` accept the same per-event metadata as an ordinary append: registered `eventSource`/`eventStream` routing, `eventStreamType`, `eventStreamId`, `eventSourceType`, `subject`, `occurred`, `tags` and a `concurrencyScope`. The unit of work keeps the values with each event (tags and the occurrence time are copied when you enroll the event) and passes them to the append when you commit, in the order you enrolled the events.

```typescript
const unitOfWork = store.unitOfWorkManager.begin();

await store.eventLog.transactional.append('order-123', new TransactionalOrderPlaced('order-123', 99.95), {
    eventStreamType: 'Orders',
    eventStreamId: 'order-123',
    subject: 'customer-42',
    occurred: new Date('2026-03-04T05:06:07Z'),
    tags: ['priority'],
    concurrencyScope: { sequenceNumber: expectedOrderRevision, eventSourceId: true }
});

await unitOfWork.commit();
```

- Chronicle validates one concurrency scope per event source identifier in an append, so every event a unit of work holds for the same event source identifier in the same event sequence must carry an equal scope or none. A different scope throws `ConflictingConcurrencyScopesInUnitOfWork` when you enroll the event, and the unit of work keeps the events it already had.
- A unit of work commits one append per event sequence. Events in the same event sequence are appended as one batch; events in different event sequences are separate appends, so a failure in a later sequence does not undo an earlier one.
- A rejected append, such as a stale concurrency scope, shows up in `getConcurrencyViolations()` and `isSuccess` after the commit.
