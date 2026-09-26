```typescript
import { IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

class MaterializedPaginationProduct {
    @field(String) readonly name: string;
    @field(Number) readonly price: number;

    constructor(name: string, price: number) {
        this.name = name;
        this.price = price;
    }
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
