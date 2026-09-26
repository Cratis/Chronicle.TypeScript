```typescript
import { eventType, onceOnly, reactor, EventContext } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EventSequenceReactorAttributeShipmentDispatched {
    @field(String) readonly trackingNumber: string;

    constructor(trackingNumber: string) {
        this.trackingNumber = trackingNumber;
    }
}

@reactor('shipment-reactor', 'fulfillment-events')
class EventSequenceReactorAttributeShipmentReactor {
    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    @onceOnly()
    async eventSequenceReactorAttributeShipmentDispatched(event: EventSequenceReactorAttributeShipmentDispatched, context: EventContext): Promise<void> {
        await this.notifyCarrier(event.trackingNumber);
    }

    private async notifyCarrier(trackingNumber: string): Promise<void> {}
}
```
