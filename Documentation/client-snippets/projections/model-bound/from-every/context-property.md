```typescript title="Update an audit timestamp from every event"
import { eventType, fromEvent, fromEvery, readModel } from '@cratis/chronicle';

@eventType()
class InventoryProductRegisteredForEvery {
    constructor(readonly productName: string) {}
}

@eventType()
class InventoryItemsAdjustedForEvery {
    constructor(readonly quantity: number) {}
}

@readModel()
@fromEvent(InventoryProductRegisteredForEvery)
@fromEvent(InventoryItemsAdjustedForEvery)
class InventoryStatusFromEvery {
    productName = '';

    @fromEvery(undefined, 'occurred')
    lastUpdated = new Date();
}
```
