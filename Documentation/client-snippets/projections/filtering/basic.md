```typescript
import { eventType, fromEvent } from '@cratis/chronicle';

@eventType()
export class FilteringOrderPlaced {
    customerId = '';
    totalAmount = 0;
}

@eventType()
export class FilteringOrderShipped {
    shippedAt: Date | null = null;
}

@fromEvent(FilteringOrderPlaced)
@fromEvent(FilteringOrderShipped)
export class FilteringOrderSummary {
    customerId = '';
    totalAmount = 0;
    shippedAt: Date | null = null;
}
```
