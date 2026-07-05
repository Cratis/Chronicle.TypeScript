```typescript
import { eventType, fromEvent, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class MbConstantKeyOrderPlaced {
    customerName = '';
    placedAt = new Date();
}

@readModel()
@fromEvent(MbConstantKeyOrderPlaced, { constantKey: 'global' })
class MbConstantKeyGlobalOrderSummary {
    @setFrom(MbConstantKeyOrderPlaced, 'customerName')
    lastCustomer = '';

    @setFrom(MbConstantKeyOrderPlaced, 'placedAt')
    lastOrderDate = new Date();
}
```
