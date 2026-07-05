```typescript
const result = await store.eventLog.append(
    eventSourceId,
    new OrderPlaced(customerId, total)
);

if (!result.isSuccess) {
    for (const error of result.errors) {
        console.log(`Schema error: ${error.message}`);
    }
}
```
