```typescript
import { eventType, fromEvent, Guid, setFrom, setValue } from '@cratis/chronicle';

@eventType()
export class MbSetValueOrderPlaced {
    customerName = '';
}

@eventType()
export class MbSetValueOrderCanceled {
}

@fromEvent(MbSetValueOrderPlaced)
@fromEvent(MbSetValueOrderCanceled)
export class MbSetValueOrder {
    id: Guid = Guid.empty;

    @setFrom(MbSetValueOrderPlaced, 'customerName')
    customerName = '';

    @setValue(MbSetValueOrderPlaced, 'active')
    @setValue(MbSetValueOrderCanceled, 'canceled')
    status = '';
}
```
