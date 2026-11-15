```typescript
import { EventContext, eventSourceType, eventStreamType, eventType, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class StreamAndSourceTypeOrderShipped {
    @field(String) readonly trackingNumber: string;

    constructor(trackingNumber: string = '') {
        this.trackingNumber = trackingNumber;
    }
}

@eventType()
class StreamAndSourceTypeDeliveryScheduled {
    @field(String) readonly trackingNumber: string;

    constructor(trackingNumber: string = '') {
        this.trackingNumber = trackingNumber;
    }
}

// The reactor observes only 'order' events in the 'fulfillment' stream type. A bare event it
// returns is appended with that event source type and stream type; a returned
// EventForEventSourceId keeps the metadata it sets itself.
@reactor()
@eventSourceType('order')
@eventStreamType('fulfillment')
class StreamAndSourceTypeDeliveryReactor {
    @onceOnly()
    async streamAndSourceTypeOrderShipped(event: StreamAndSourceTypeOrderShipped, context: EventContext): Promise<StreamAndSourceTypeDeliveryScheduled> {
        return new StreamAndSourceTypeDeliveryScheduled(event.trackingNumber);
    }
}
```
