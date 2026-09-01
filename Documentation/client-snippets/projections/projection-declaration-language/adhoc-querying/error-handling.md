```typescript
import { UnableToQueryProjection } from '@cratis/chronicle';

try {
    const result = await store.projections.query(`
        projection Orders
          from OrderPlaced
    `);
} catch (error) {
    if (error instanceof UnableToQueryProjection) {
        console.log(error.message);
    }
}
```
