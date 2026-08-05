```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class CompositeOrderCreated {
    constructor(
        readonly customerId: string = '',
        readonly orderNumber: string = '',
        readonly customerName: string = '',
        readonly orderDate: Date = new Date()
    ) {}
}

@eventType()
class CompositeOrderShipped {
    constructor(
        readonly customerId: string = '',
        readonly orderNumber: string = '',
        readonly shippedDate: Date = new Date()
    ) {}
}
```
