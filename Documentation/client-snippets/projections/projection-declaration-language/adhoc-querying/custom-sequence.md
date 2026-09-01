```typescript
const result = await store.projections.query(
    `
    projection InboxMessages
      from MessageReceived
    `,
    'inbox');
```
