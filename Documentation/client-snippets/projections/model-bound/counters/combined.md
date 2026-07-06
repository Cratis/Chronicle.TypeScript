```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class MbCountersItemCreated {
    name = '';
    initialQuantity = 0;
}

@eventType()
class MbCountersItemRestocked {
}

@eventType()
class MbCountersItemSold {
}

@readModel()
class MbCountersInventoryItem {
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
