```typescript title="Map event context"
import { eventType, fromEvent, setFrom, setFromContext } from '@cratis/chronicle';

@eventType()
export class OrderPlacedForAudit {
    constructor(readonly customerName: string) {}
}

@fromEvent(OrderPlacedForAudit)
export class AuditedOrder {
    @setFrom(OrderPlacedForAudit, 'customerName')
    customerName = '';

    @setFromContext(OrderPlacedForAudit, 'occurred')
    orderedAt = new Date();
}
```
