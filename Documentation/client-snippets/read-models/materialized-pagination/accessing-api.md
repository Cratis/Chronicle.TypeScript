```typescript
import { IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

class MaterializedPaginationOrder {
    @field(String) readonly customerName: string;
    @field(Number) readonly total: number;

    constructor(customerName: string, total: number) {
        this.customerName = customerName;
        this.total = total;
    }
}

class MaterializedPaginationAccessingApi {
    constructor(private readonly store: IEventStore) {}

    // Inject IEventStore, then reach through to the materialized API
    async getOrders(): Promise<MaterializedPaginationOrder[]> {
        return this.store.readModels.materialized.getInstances(MaterializedPaginationOrder);
    }
}
```
