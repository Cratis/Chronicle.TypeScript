```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class DecFromEventSequenceOrderCreated {
    orderNumber = '';
    customerId = '';
    totalAmount = 0;
}

@eventType()
class DecFromEventSequenceOrderUpdated {
    orderNumber = '';
    newTotalAmount = 0;
}

@eventType()
class DecFromEventSequenceOrderShipped {
    orderNumber = '';
    shippedAt = new Date();
}
```
