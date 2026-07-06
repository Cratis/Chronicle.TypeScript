```typescript
import { eventType, Guid, join, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class MbJoinsMultipleOrderPlaced {
    customerId: Guid = Guid.empty;
}

@eventType()
class MbJoinsMultipleCustomerCreated {
    name = '';
}

@eventType()
class MbJoinsCustomerUpdated {
    email = '';
}

@eventType()
class MbJoinsShippingAddressSet {
    address = '';
}

@readModel()
class MbJoinsEnrichedOrder {
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
