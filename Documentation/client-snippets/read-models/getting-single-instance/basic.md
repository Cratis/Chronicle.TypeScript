```typescript
const account = await store.readModels.findInstanceById(AccountInfo, accountId);

if (account !== null) {
    console.log(`${account.name}: ${account.balance}`);
}
```
