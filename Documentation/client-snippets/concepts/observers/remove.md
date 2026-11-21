```typescript
const result = await store.observers.remove('the-observer');
if (!result.isRemoved) {
    console.log(`Not removed: ${result.outcome} in namespace ${result.blockingNamespace}`);
}
```
