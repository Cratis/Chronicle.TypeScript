```typescript
import { eventType, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EventSequenceShipmentDispatched {
    @field(String) readonly trackingNumber: string;

    constructor(trackingNumber: string) {
        this.trackingNumber = trackingNumber;
    }
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
