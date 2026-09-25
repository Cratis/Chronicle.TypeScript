```typescript title="Update an audit timestamp from every event"
import { eventType, fromEvent, fromEvery } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

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
    @field(String) productName = '';

    @fromEvery(undefined, 'occurred')
    lastUpdated = new Date();
}
```
