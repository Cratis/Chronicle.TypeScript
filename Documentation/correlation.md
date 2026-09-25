---
title: Correlation
description: Control the correlation ID the TypeScript client sends with every append.
---

See [Correlation, identity, and causation](/chronicle/concepts/correlation-identity-causation/) for what a correlation ID is and why Chronicle tracks it. This page covers the TypeScript-specific API in depth. A `CorrelationId` is sent with every event append as the `CorrelationId` field.

## `CorrelationId`

```typescript
import { CorrelationId } from '@cratis/chronicle';

// Generate a new unique correlation ID
const id = CorrelationId.create();

// Wrap an existing string (e.g. from an incoming X-Correlation-Id header)
const fromHeader = new CorrelationId('d4e5f6a7-8b9c-4d0e-9f1a-2b3c4d5e6f70');

// Well-known sentinel for an unset ID
const empty = CorrelationId.notSet;

console.log(id.toString()); // 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
```

## Managing the correlation ID for a call context

The module exports a singleton `correlationIdManager` backed by Node.js [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage). The ID is scoped automatically to the active async context — no need to pass it through every function call.

### Reading the current ID

```typescript
import { correlationIdManager } from '@cratis/chronicle';

const id = correlationIdManager.current;
// If nothing has been set in this context, a new GUID is generated on each access.
```

### Setting a fixed ID

```typescript
import { correlationIdManager, CorrelationId } from '@cratis/chronicle';

correlationIdManager.setCurrent(new CorrelationId('d4e5f6a7-8b9c-4d0e-9f1a-2b3c4d5e6f70'));
```

### Resetting to a new ID

```typescript
correlationIdManager.clear(); // replaces the stored ID with a fresh GUID
```

### Express middleware example

This excerpt assumes an Express `app`.

```typescript
import express from 'express';
import { correlationIdManager, CorrelationId } from '@cratis/chronicle';

app.use((req, res, next) => {
    const header = req.headers['x-correlation-id'];
    const id = header
        ? new CorrelationId(String(header))
        : CorrelationId.create();

    res.setHeader('x-correlation-id', id.toString());
    correlationIdManager.run(id, () => next());
});
```

For concurrent or nested work, use `correlationIdManager.run(id, callback)` to restore the caller's correlation ID after the callback and its async children complete. The existing `setCurrent()` and `clear()` APIs remain available but do not restore a parent scope.

## Interface segregation

`CorrelationIdManager` implements two separate interfaces, following the same pattern as the .NET client:

| Interface | Purpose |
|-----------|---------|
| `ICorrelationIdAccessor` | Read-only access — exposes `current`. Inject this where you only need to read the ID. |
| `ICorrelationIdSetter` | Write access — exposes `setCurrent()` and `clear()`. Inject this where you need to set or reset the ID. |

```typescript
import { ICorrelationIdAccessor, ICorrelationIdSetter, CorrelationIdManager } from '@cratis/chronicle';

// Narrow the type for read-only consumers
function logCorrelation(accessor: ICorrelationIdAccessor) {
    console.log('Correlation:', accessor.current.toString());
}

// Narrow the type for writers (e.g. middleware, test setup)
function resetForTest(setter: ICorrelationIdSetter) {
    setter.clear();
}

const manager = new CorrelationIdManager();
logCorrelation(manager);
resetForTest(manager);
```

## How correlation flows into events

When you call `eventLog.append()` or `eventLog.appendMany()`, the Chronicle client automatically uses `correlationIdManager.current` as the `CorrelationId` for the gRPC request unless you provide an explicit `correlationId` in `AppendOptions`. That option takes a `string` or a `Guid`, so pass a `CorrelationId`'s `value`. This excerpt assumes a `store`, an `eventSourceId`, and an `EmployeeHired` event type:

```typescript
import { CorrelationId } from '@cratis/chronicle';

// Uses correlationIdManager.current automatically
await store.eventLog.append(eventSourceId, new EmployeeHired('Jane', 'Doe'));

// Override for this single append
await store.eventLog.append(eventSourceId, new EmployeeHired('Jane', 'Doe'), {
    correlationId: CorrelationId.create().value
});
```
