```typescript
const result = await store.eventLog.append(
    eventSourceId,
    new OrderPlaced(customerId, total)
);

if (!result.isSuccess) {
    for (const violation of result.constraintViolations) {
        if (violation.constraintId === 'SchemaValidation') {
            console.log(`Schema error at ${violation.details.path}: ${violation.message}`);
        }
    }
}
```
