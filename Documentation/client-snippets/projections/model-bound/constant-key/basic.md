```typescript
import { eventType, fromEvent, setFrom } from '@cratis/chronicle';

@eventType()
export class MbConstantKeyOrderPlaced {
    customerName = '';
    placedAt = new Date();
}

@fromEvent(MbConstantKeyOrderPlaced, { constantKey: 'global' })
export class MbConstantKeyGlobalOrderSummary {
    @setFrom(MbConstantKeyOrderPlaced, 'customerName')
    lastCustomer = '';

    @setFrom(MbConstantKeyOrderPlaced, 'placedAt')
    lastOrderDate = new Date();
}
```
