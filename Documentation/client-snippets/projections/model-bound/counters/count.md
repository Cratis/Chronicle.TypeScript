```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
export class MbCountersOrderPlaced {
}

@eventType()
export class MbCountersOrderCancelled {
}

export class MbCountersEventMetrics {
    id: Guid = Guid.empty;

    @count(MbCountersOrderPlaced)
    totalOrders = 0;

    @count(MbCountersOrderCancelled)
    cancelledOrders = 0;
}
```
