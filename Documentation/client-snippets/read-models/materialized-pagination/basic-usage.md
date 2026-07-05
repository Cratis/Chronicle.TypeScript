```typescript
import { IEventStore } from '@cratis/chronicle';

class MaterializedPaginationBasicUsage {
    constructor(private readonly store: IEventStore) {}

    async getOrders(): Promise<MaterializedPaginationOrder[]> {
        return this.store.readModels.materialized.getInstances(MaterializedPaginationOrder);
    }
}
```
