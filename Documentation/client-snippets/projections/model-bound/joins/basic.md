```typescript
import { eventType, Guid, join, setFrom } from '@cratis/chronicle';

@eventType()
export class MbJoinsOrderPlaced {
    customerId: Guid = Guid.empty;
    amount = 0;
}

@eventType()
export class MbJoinsCustomerCreated {
    name = '';
}

export class MbJoinsOrderSummary {
    id: Guid = Guid.empty;

    @setFrom(MbJoinsOrderPlaced, 'amount')
    amount = 0;

    @setFrom(MbJoinsOrderPlaced, 'customerId')
    customerId: Guid = Guid.empty;

    @join(MbJoinsCustomerCreated, 'customerId', 'name')
    customerName = '';
}
```
