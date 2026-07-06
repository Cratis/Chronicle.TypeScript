```typescript
const snapshots = await store.readModels.getSnapshotsById(Order, orderId);

for (const snapshot of snapshots) {
    console.log(`Snapshot at ${snapshot.occurred?.toISOString() ?? 'unknown'}`);
    console.log(`  Correlation ID: ${snapshot.correlationId ?? 'none'}`);
    console.log(`  Event count: ${snapshot.events.length}`);
    console.log('  State:', snapshot.readModel);
}
```
