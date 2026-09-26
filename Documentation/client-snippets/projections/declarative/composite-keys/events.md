```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class CompositeOrderCreated {
    @field(String) readonly customerId: string;
    @field(String) readonly orderNumber: string;
    @field(String) readonly customerName: string;
    @field(Date) readonly orderDate: Date;

    constructor(customerId: string = '', orderNumber: string = '', customerName: string = '', orderDate: Date = new Date()) {
        this.customerId = customerId;
        this.orderNumber = orderNumber;
        this.customerName = customerName;
        this.orderDate = orderDate;
    }
}

@eventType()
class CompositeOrderShipped {
    @field(String) readonly customerId: string;
    @field(String) readonly orderNumber: string;
    @field(Date) readonly shippedDate: Date;

    constructor(customerId: string = '', orderNumber: string = '', shippedDate: Date = new Date()) {
        this.customerId = customerId;
        this.orderNumber = orderNumber;
        this.shippedDate = shippedDate;
    }
}
```
