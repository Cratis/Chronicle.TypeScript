```typescript
import { reducer } from '@cratis/chronicle';

class ReducersGettingStartedAttributeOrderSummary {
    orderId = '';
}

@reducer('order-summary', 'order-events', ReducersGettingStartedAttributeOrderSummary)
class ReducersGettingStartedAttributeOrderSummaryReducer {
}
```
