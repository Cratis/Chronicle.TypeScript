```typescript title="Map event context"
import { eventType, fromEvent, readModel, setFrom, setFromContext } from '@cratis/chronicle';

@eventType()
class OrderPlacedForAudit {
    constructor(readonly customerName: string) {}
}

@readModel()
@fromEvent(OrderPlacedForAudit)
class AuditedOrder {
    @setFrom(OrderPlacedForAudit, 'customerName')
    customerName = '';

    @setFromContext(OrderPlacedForAudit, 'occurred')
    orderedAt = new Date();
}
```
