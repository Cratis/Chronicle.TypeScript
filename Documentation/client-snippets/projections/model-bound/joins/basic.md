```typescript
import { eventType, Guid, join, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class MbJoinsOrderPlaced {
    customerId: Guid = Guid.empty;
    amount = 0;
}

@eventType()
class MbJoinsCustomerCreated {
    name = '';
}

@readModel()
class MbJoinsOrderSummary {
    id: Guid = Guid.empty;

    @setFrom(MbJoinsOrderPlaced, 'amount')
    amount = 0;

    @setFrom(MbJoinsOrderPlaced, 'customerId')
    customerId: Guid = Guid.empty;

    @join(MbJoinsCustomerCreated, 'customerId', 'name')
    customerName = '';
}
```
