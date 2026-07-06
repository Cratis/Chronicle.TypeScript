```typescript
const orders = await store.readModels.getInstances(Order, 1000n);

console.log(`Replayed ${orders.length} orders from the capped history.`);
```
