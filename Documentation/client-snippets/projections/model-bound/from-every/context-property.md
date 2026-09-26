```typescript title="Update an audit timestamp from every event"
import { eventType, fromEvent, fromEvery } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class InventoryProductRegisteredForEvery {
    @field(String) readonly productName: string;

    constructor(productName: string) {
        this.productName = productName;
    }
}

@eventType()
export class InventoryItemsAdjustedForEvery {
    @field(Number) readonly quantity: number;

    constructor(quantity: number) {
        this.quantity = quantity;
    }
}

@fromEvent(InventoryProductRegisteredForEvery)
@fromEvent(InventoryItemsAdjustedForEvery)
export class InventoryStatusFromEvery {
    @field(String) productName = '';

    @fromEvery(undefined, 'occurred')
    lastUpdated = new Date();
}
```
