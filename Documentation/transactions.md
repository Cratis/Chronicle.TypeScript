# Transactions (Unit of Work)

The Chronicle TypeScript client supports transaction-scoped event appends through a Unit of Work API.

## Start a Unit of Work

```typescript
const store = await client.getEventStore('MyStore');
const unitOfWork = store.unitOfWorkManager.begin();
```

## Append Through the Transactional Event Sequence

Use `eventLog.transactional` to stage events in the current unit of work:

```typescript
await store.eventLog.transactional.append('order-123', new OrderCreated());

await store.eventLog.transactional.appendMany('order-123', [
    new OrderLineAdded('sku-1', 2),
    new OrderConfirmed()
]);
```

These calls buffer events in the unit of work. They do not append immediately.

## Commit or Roll Back

```typescript
await unitOfWork.commit();
```

If you need to discard staged events:

```typescript
await unitOfWork.rollback();
```

## Appending to Multiple Event Sources in One Unit of Work

You can stage events across event sources, then commit once:

```typescript
await store.eventLog.transactional.append('customer-42', new CustomerUpdated());
await store.eventLog.transactional.append('order-123', new OrderConfirmed());

await unitOfWork.commit();
```

Internally, commit uses `appendMany(eventsForEventSourceId, options?)` support on event sequences.
