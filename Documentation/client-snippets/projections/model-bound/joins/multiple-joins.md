```typescript
import { eventType, Guid, join, setFrom } from '@cratis/chronicle';

@eventType()
export class MbJoinsMultipleOrderPlaced {
    customerId: Guid = Guid.empty;
}

@eventType()
export class MbJoinsMultipleCustomerCreated {
    name = '';
}

@eventType()
export class MbJoinsCustomerUpdated {
    email = '';
}

@eventType()
export class MbJoinsShippingAddressSet {
    address = '';
}

export class MbJoinsEnrichedOrder {
    id: Guid = Guid.empty;

    @setFrom(MbJoinsMultipleOrderPlaced, 'customerId')
    customerId: Guid = Guid.empty;

    @join(MbJoinsMultipleCustomerCreated, 'customerId', 'name')
    customerName = '';

    @join(MbJoinsCustomerUpdated, 'customerId', 'email')
    customerEmail = '';

    // ShippingAddressSet is raised on the order's own event source, so it joins on the
    // read model's own key rather than a separate correlating property.
    @join(MbJoinsShippingAddressSet, 'id', 'address')
    shippingAddress = '';
}
```
