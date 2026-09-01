```typescript
import { EventContext, eventType, reactor } from '@cratis/chronicle';

@eventType()
class EventSequenceReactorShipmentDispatched {
    constructor(readonly trackingNumber: string) {}
}

@reactor('', 'fulfillment-events')
class EventSequenceShipmentReactor {
    async eventSequenceReactorShipmentDispatched(event: EventSequenceReactorShipmentDispatched, context: EventContext): Promise<void> {
        await this.notifyCarrier(event.trackingNumber);
    }

    private async notifyCarrier(trackingNumber: string): Promise<void> {}
}
```
