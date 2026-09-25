```typescript
// Canonical read-by-key API. Use when the instance is known to exist.
const account = await store.readModels.getInstanceById(AccountInfo, accountId);
console.log(`${account.name}: ${account.balance}`);

// To detect a missing key, use the TypeScript nullable convenience API instead.
const optionalAccount = await store.readModels.findInstanceById(AccountInfo, accountId);
if (optionalAccount !== null) {
    console.log(`${optionalAccount.name}: ${optionalAccount.balance}`);
}
```
