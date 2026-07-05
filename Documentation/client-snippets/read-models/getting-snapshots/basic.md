```typescript
const snapshots = await store.readModels.getSnapshotsById(Order, orderId);

console.log(`Found ${snapshots.length} snapshots.`);
```
