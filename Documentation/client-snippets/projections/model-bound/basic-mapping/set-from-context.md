```typescript title="Map event context"
import { eventType, fromEvent, setFrom, setFromContext } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class OrderPlacedForAudit {
    @field(String) readonly customerName: string;

    constructor(customerName: string) {
        this.customerName = customerName;
    }
}

@fromEvent(OrderPlacedForAudit)
export class AuditedOrder {
    @setFrom(OrderPlacedForAudit, 'customerName')
    customerName = '';

    @setFromContext(OrderPlacedForAudit, 'occurred')
    orderedAt = new Date();
}
```
