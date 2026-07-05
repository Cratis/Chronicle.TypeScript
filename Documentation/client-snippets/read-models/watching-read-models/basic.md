```typescript
for await (const changeset of store.readModels.watch(Order)) {
    if (changeset.removed) {
        continue;
    }

    console.log(`${changeset.key}: ${changeset.readModel.status}`);
}
```
