---
title: Transactions and unit of work
description: Where transactions are documented, and the TypeScript unit-of-work result accessors.
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
