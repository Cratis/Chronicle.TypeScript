```typescript
interface PdlOrderSummary {
    orderId: string;
}

const result = await store.projections.query(`
    projection OrderSummary
      from OrderPlaced
`);

const summaries = result.readModelEntries.map(json => JSON.parse(json) as PdlOrderSummary);
```
