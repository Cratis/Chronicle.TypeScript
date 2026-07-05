```typescript
import { childrenFrom, eventType, Guid, join, readModel, setFrom } from '@cratis/chronicle';

// Events
@eventType()
class MbJoinsFullOrderPlaced {
    customerId: Guid = Guid.empty;
    placedAt = new Date();
}

@eventType()
class MbJoinsFullCustomerRegistered {
    name = '';
    email = '';
}

@eventType()
class MbJoinsFullCustomerProfileUpdated {
    phoneNumber = '';
}

@eventType()
class MbJoinsFullLineItemAdded {
    productId: Guid = Guid.empty;
    quantity = 0;
}

@eventType()
class MbJoinsFullProductCreated {
    name = '';
    price = 0;
}

@eventType()
class MbJoinsFullProductPriceChanged {
    newPrice = 0;
}

// Read Models
@readModel()
class MbJoinsFullOrderDetails {
    id: Guid = Guid.empty;

    @setFrom(MbJoinsFullOrderPlaced, 'placedAt')
    placedAt = new Date();

    @setFrom(MbJoinsFullOrderPlaced, 'customerId')
    customerId: Guid = Guid.empty;

    // Join customer information
    @join(MbJoinsFullCustomerRegistered, 'customerId', 'name')
    customerName = '';

    @join(MbJoinsFullCustomerRegistered, 'customerId', 'email')
    customerEmail = '';

    @join(MbJoinsFullCustomerProfileUpdated, 'customerId', 'phoneNumber')
    customerPhone = '';

    @childrenFrom(MbJoinsFullLineItemAdded, 'productId')
    items: MbJoinsFullLineItemDetails[] = [];
}

// Keyed by product id, so the joins below resolve implicitly through the child's own key.
class MbJoinsFullLineItemDetails {
    id: Guid = Guid.empty;

    @setFrom(MbJoinsFullLineItemAdded, 'quantity')
    quantity = 0;

    // Join product information
    @join(MbJoinsFullProductCreated, undefined, 'name')
    productName = '';

    @join(MbJoinsFullProductCreated, undefined, 'price')
    @join(MbJoinsFullProductPriceChanged, undefined, 'newPrice')
    price = 0;
}
```
