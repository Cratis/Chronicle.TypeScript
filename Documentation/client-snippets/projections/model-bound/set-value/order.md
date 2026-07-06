```typescript
import { eventType, fromEvent, Guid, readModel, setFrom, setValue } from '@cratis/chronicle';

@eventType()
class MbSetValueOrderPlaced {
    customerName = '';
}

@eventType()
class MbSetValueOrderCanceled {
}

@readModel()
@fromEvent(MbSetValueOrderPlaced)
@fromEvent(MbSetValueOrderCanceled)
class MbSetValueOrder {
    id: Guid = Guid.empty;

    @setFrom(MbSetValueOrderPlaced, 'customerName')
    customerName = '';

    @setValue(MbSetValueOrderPlaced, 'active')
    @setValue(MbSetValueOrderCanceled, 'canceled')
    status = '';
}
```
