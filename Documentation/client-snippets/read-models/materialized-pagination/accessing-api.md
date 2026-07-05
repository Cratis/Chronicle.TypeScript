```typescript
import { IEventStore } from '@cratis/chronicle';

class MaterializedPaginationOrder {
    constructor(
        readonly customerName: string,
        readonly total: number
    ) {}
}

class MaterializedPaginationAccessingApi {
    constructor(private readonly store: IEventStore) {}

    // Inject IEventStore, then reach through to the materialized API
    async getOrders(): Promise<MaterializedPaginationOrder[]> {
        return this.store.readModels.materialized.getInstances(MaterializedPaginationOrder);
    }
}
```
