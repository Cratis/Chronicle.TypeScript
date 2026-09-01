```typescript
// This declaration will throw UnableToQueryProjection:
// OrderPlaced.value is a string, but OrderShipped.value is a number
const result = await store.projections.query(`
    projection Bad
      from OrderPlaced   // value: string
      from OrderShipped  // value: number -> incompatible types
`);
```
