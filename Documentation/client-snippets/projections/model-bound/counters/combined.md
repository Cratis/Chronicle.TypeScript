```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
export class MbCountersItemCreated {
    name = '';
    initialQuantity = 0;
}

@eventType()
export class MbCountersItemRestocked {
}

@eventType()
export class MbCountersItemSold {
}

export class MbCountersInventoryItem {
    id: Guid = Guid.empty;

    @setFrom(MbCountersItemCreated, 'name')
    name = '';

    @setFrom(MbCountersItemCreated, 'initialQuantity')
    @increment(MbCountersItemRestocked)
    @decrement(MbCountersItemSold)
    quantity = 0;

    @count(MbCountersItemRestocked)
    restockCount = 0;

    @count(MbCountersItemSold)
    salesCount = 0;
}
```
