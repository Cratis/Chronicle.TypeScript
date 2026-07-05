```typescript
const accounts = await store.readModels.getInstances(Account);

for (const account of accounts) {
    console.log(`${account.name}: ${account.balance}`);
}
```
