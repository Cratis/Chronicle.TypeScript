```typescript
for await (const changeset of store.readModels.watch(Order)) {
    if (changeset.readModel.totalAmount <= threshold) {
        continue;
    }

    console.log(`${changeset.key}: ${changeset.readModel.totalAmount}`);
}
```
