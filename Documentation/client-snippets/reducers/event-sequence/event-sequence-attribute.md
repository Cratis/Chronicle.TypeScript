```typescript
import { eventType, reducer } from '@cratis/chronicle';

@eventType()
class EventSequenceShipmentDispatched {
    constructor(readonly trackingNumber: string) {}
}

class EventSequenceShipmentStatus {
    trackingNumber = '';
}

@reducer('', 'fulfillment-events', EventSequenceShipmentStatus)
class EventSequenceShipmentReducer {
    eventSequenceShipmentDispatched(
        event: EventSequenceShipmentDispatched,
        current: EventSequenceShipmentStatus | undefined
    ): EventSequenceShipmentStatus {
        return { trackingNumber: event.trackingNumber };
    }
}
```
