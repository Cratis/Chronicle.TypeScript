```typescript
import { IEventStore } from '@cratis/chronicle';

class MaterializedPaginationProduct {
    constructor(
        readonly name: string,
        readonly price: number
    ) {}
}

class MaterializedPaginationObserving {
    constructor(private readonly store: IEventStore) {}

    async run(): Promise<void> {
        // Called whenever the stored instances change
        for await (const products of this.store.readModels.materialized.observeInstances(MaterializedPaginationProduct, 0, 50)) {
            console.log(`Products updated: ${products.length} in view`);
        }
    }
}
```
