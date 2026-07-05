```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class MbCountersOrderPlaced {
}

@eventType()
class MbCountersOrderCancelled {
}

@readModel()
class MbCountersEventMetrics {
    id: Guid = Guid.empty;

    @count(MbCountersOrderPlaced)
    totalOrders = 0;

    @count(MbCountersOrderCancelled)
    cancelledOrders = 0;
}
```
