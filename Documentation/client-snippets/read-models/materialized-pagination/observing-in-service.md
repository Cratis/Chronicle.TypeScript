```typescript
import { IEventStore } from '@cratis/chronicle';

class MaterializedPaginationProductDashboard {
    constructor(private readonly store: IEventStore) {}

    async start(updateView: (products: MaterializedPaginationProduct[]) => void): Promise<void> {
        for await (const products of this.store.readModels.materialized.observeInstances(MaterializedPaginationProduct, 0, 100)) {
            updateView(products);
        }
    }
}
```
