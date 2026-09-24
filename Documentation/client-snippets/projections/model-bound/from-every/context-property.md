```typescript title="Update an audit timestamp from every event"
import { eventType, fromEvent, fromEvery } from '@cratis/chronicle';

@eventType()
export class InventoryProductRegisteredForEvery {
    constructor(readonly productName: string) {}
}

@eventType()
export class InventoryItemsAdjustedForEvery {
    constructor(readonly quantity: number) {}
}

@fromEvent(InventoryProductRegisteredForEvery)
@fromEvent(InventoryItemsAdjustedForEvery)
export class InventoryStatusFromEvery {
    productName = '';

    @fromEvery(undefined, 'occurred')
    lastUpdated = new Date();
}
```
