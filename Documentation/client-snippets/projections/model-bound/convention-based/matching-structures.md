```typescript title="Matching nested structures and collections"
import { eventType, fromEvent, readModel } from '@cratis/chronicle';

class ConventionAddress {
    street = '';
    city = '';
    postalCode = '';
}

class ConventionLineItem {
    productName = '';
    unitPrice = 0;
    quantity = 0;
}

@eventType()
class ConventionCustomerRegistered {
    constructor(
        readonly firstName: string,
        readonly lastName: string,
        readonly billingAddress: ConventionAddress,
        readonly shippingAddress: ConventionAddress
    ) {}
}

@eventType()
class ConventionOrderCreated {
    constructor(
        readonly customerEmail: string,
        readonly items: ConventionLineItem[],
        readonly tags: string[]
    ) {}
}

@readModel()
@fromEvent(ConventionCustomerRegistered)
class ConventionCustomer {
    firstName = '';
    lastName = '';
    billingAddress = new ConventionAddress();
    shippingAddress = new ConventionAddress();
}

@readModel()
@fromEvent(ConventionOrderCreated)
class ConventionOrder {
    customerEmail = '';
    items: ConventionLineItem[] = [];
    tags: string[] = [];
}
```
