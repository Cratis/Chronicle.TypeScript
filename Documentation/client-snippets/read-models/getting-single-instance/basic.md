```typescript
const account = await store.readModels.getInstanceById(AccountInfo, accountId);

console.log(`${account.name}: ${account.balance}`);
```
