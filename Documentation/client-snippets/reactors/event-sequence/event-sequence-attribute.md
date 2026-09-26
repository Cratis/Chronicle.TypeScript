```typescript
import { EventContext, eventType, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EventSequenceReactorShipmentDispatched {
    @field(String) readonly trackingNumber: string;

    constructor(trackingNumber: string) {
        this.trackingNumber = trackingNumber;
    }
}

@reactor('', 'fulfillment-events')
class EventSequenceShipmentReactor {
    @onceOnly()
    async eventSequenceReactorShipmentDispatched(event: EventSequenceReactorShipmentDispatched, context: EventContext): Promise<void> {
        await this.notifyCarrier(event.trackingNumber);
    }

    private async notifyCarrier(trackingNumber: string): Promise<void> {}
}
```
