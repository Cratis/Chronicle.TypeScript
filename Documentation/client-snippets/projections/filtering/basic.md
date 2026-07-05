```typescript
import { eventType, fromEvent, readModel } from '@cratis/chronicle';

@eventType()
class FilteringOrderPlaced {
    customerId = '';
    totalAmount = 0;
}

@eventType()
class FilteringOrderShipped {
    shippedAt: Date | null = null;
}

@readModel()
@fromEvent(FilteringOrderPlaced)
@fromEvent(FilteringOrderShipped)
class FilteringOrderSummary {
    customerId = '';
    totalAmount = 0;
    shippedAt: Date | null = null;
}
```
