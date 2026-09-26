```typescript
import { eventType, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class FilteringOrderPlaced {
    customerId = '';
    totalAmount = 0;
}

@eventType()
export class FilteringOrderShipped {
    @field(Date) shippedAt: Date | null = null;
}

@fromEvent(FilteringOrderPlaced)
@fromEvent(FilteringOrderShipped)
export class FilteringOrderSummary {
    @field(String) customerId = '';
    @field(Number) totalAmount = 0;
    @field(Date) shippedAt: Date | null = null;
}
```
