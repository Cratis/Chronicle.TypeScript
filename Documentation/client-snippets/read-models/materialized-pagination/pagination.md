```typescript
import { IEventStore } from '@cratis/chronicle';

class MaterializedPaginationPagination {
    constructor(private readonly store: IEventStore) {}

    async getPages(): Promise<void> {
        // First page of 20
        const page1 = await this.store.readModels.materialized.getInstances(MaterializedPaginationOrder, 0, 20);
        console.log(`Page 1: ${page1.length} orders`);

        // Second page of 20
        const page2 = await this.store.readModels.materialized.getInstances(MaterializedPaginationOrder, 20, 20);
        console.log(`Page 2: ${page2.length} orders`);

        // Third page of 20
        const page3 = await this.store.readModels.materialized.getInstances(MaterializedPaginationOrder, 40, 20);
        console.log(`Page 3: ${page3.length} orders`);
    }
}
```
