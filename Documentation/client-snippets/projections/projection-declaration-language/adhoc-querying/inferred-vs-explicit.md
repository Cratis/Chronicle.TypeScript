```typescript
// Inferred - schema derived from OrderPlaced and OrderShipped event properties
const inferred = await store.projections.query(`
    projection Orders
      from OrderPlaced
      from OrderShipped
`);

// Explicit - schema comes from the registered 'PdlOrderReadModel' type
const explicitResult = await store.projections.query(`
    projection Orders => PdlOrderReadModel
      from OrderPlaced
      from OrderShipped
`);
```
