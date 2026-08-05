---
sharedTopicBridge: true
---

# Transactions and Unit of Work

Unit-of-work transactions are now documented as a shared Chronicle workflow with synchronized client examples.

- [Transactions and unit of work](/chronicle/events/transactions/)
- [Appending many events](/chronicle/events/appending-many/)
- [TypeScript client setup](./getting-started.md)

## TypeScript client notes

Alongside `unitOfWork.getAppendResults()` (the full per-event detail from the latest commit), `IUnitOfWork` exposes three purpose-built accessors — thin filters over the same append results, so you don't have to filter `getAppendResults()` yourself:

- `getConstraintViolations()` — every constraint violation across the commit.
- `getConcurrencyViolations()` — every concurrency violation across the commit.
- `getAppendErrors()` — every append error across the commit.

```typescript
await unitOfWork.commit();

const constraintViolations = unitOfWork.getConstraintViolations();
const concurrencyViolations = unitOfWork.getConcurrencyViolations();
const appendErrors = unitOfWork.getAppendErrors();
```
