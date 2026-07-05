```typescript
const accounts = await store.readModels.getInstances(Account);

const highValueAccounts = accounts
    .filter((account) => account.balance > threshold)
    .sort((left, right) => right.balance - left.balance);
```
