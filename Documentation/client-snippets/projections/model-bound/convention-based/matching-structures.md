```typescript title="Matching nested structures and collections"
import { eventType, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

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
    @field(String) readonly firstName: string;
    @field(String) readonly lastName: string;
    @field(ConventionAddress) readonly billingAddress: ConventionAddress;
    @field(ConventionAddress) readonly shippingAddress: ConventionAddress;

    constructor(firstName: string, lastName: string, billingAddress: ConventionAddress, shippingAddress: ConventionAddress) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.billingAddress = billingAddress;
        this.shippingAddress = shippingAddress;
    }
}

@eventType()
export class ConventionOrderCreated {
    @field(String) readonly customerEmail: string;
    @field(Array, { genericArguments: [ConventionLineItem] }) readonly items: ConventionLineItem[];
    @field(Array, { genericArguments: [String] }) readonly tags: string[];

    constructor(customerEmail: string, items: ConventionLineItem[], tags: string[]) {
        this.customerEmail = customerEmail;
        this.items = items;
        this.tags = tags;
    }
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
    @field(Array, { genericArguments: [ConventionLineItem] }) items: ConventionLineItem[] = [];
    @field(Array, { genericArguments: [String] }) tags: string[] = [];
}
```
