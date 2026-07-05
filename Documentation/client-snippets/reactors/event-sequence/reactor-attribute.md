```typescript
import { eventType, reactor, EventContext } from '@cratis/chronicle';

@eventType()
class EventSequenceReactorAttributeShipmentDispatched {
    constructor(readonly trackingNumber: string) {}
}

@reactor('shipment-reactor', 'fulfillment-events')
class EventSequenceReactorAttributeShipmentReactor {
    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    async eventSequenceReactorAttributeShipmentDispatched(event: EventSequenceReactorAttributeShipmentDispatched, context: EventContext): Promise<void> {
        await this.notifyCarrier(event.trackingNumber);
    }

    private async notifyCarrier(trackingNumber: string): Promise<void> {}
}
```
