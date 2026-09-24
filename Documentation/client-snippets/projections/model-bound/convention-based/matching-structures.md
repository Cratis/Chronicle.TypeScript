```typescript title="Matching nested structures and collections"
import { eventType, fromEvent } from '@cratis/chronicle';

export class ConventionAddress {
    street = '';
    city = '';
    postalCode = '';
}

export class ConventionLineItem {
    productName = '';
    unitPrice = 0;
    quantity = 0;
}

@eventType()
export class ConventionCustomerRegistered {
    constructor(
        readonly firstName: string,
        readonly lastName: string,
        readonly billingAddress: ConventionAddress,
        readonly shippingAddress: ConventionAddress
    ) {}
}

@eventType()
export class ConventionOrderCreated {
    constructor(
        readonly customerEmail: string,
        readonly items: ConventionLineItem[],
        readonly tags: string[]
    ) {}
}

@fromEvent(ConventionCustomerRegistered)
export class ConventionCustomer {
    firstName = '';
    lastName = '';
    billingAddress = new ConventionAddress();
    shippingAddress = new ConventionAddress();
}

@fromEvent(ConventionOrderCreated)
export class ConventionOrder {
    customerEmail = '';
    items: ConventionLineItem[] = [];
    tags: string[] = [];
}
```
