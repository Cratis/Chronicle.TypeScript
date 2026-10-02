```typescript
import { field } from '@cratis/fundamentals';
import { eventType, eventSourceType, eventStreamType, filterEventsByTag, Guid, IEventLog, reactor } from '@cratis/chronicle';

@eventType()
class ReactorsFilteringShipmentDispatched {
    @field(String) trackingNumber = '';
}

class ReactorsFilteringShippingService {
    constructor(private readonly eventLog: IEventLog) {}

    async dispatch(trackingNumber: string): Promise<void> {
        const result = await this.eventLog.append(Guid.create().toString(),
            Object.assign(new ReactorsFilteringShipmentDispatched(), { trackingNumber }),
            { tags: ['express'], sourceType: 'shipment', streamType: 'logistics' });
        if (!result.isSuccess) throw new Error('Shipment dispatch failed');
    }
}

@reactor()
@filterEventsByTag('express')
@eventSourceType('shipment')
@eventStreamType('logistics')
class ReactorsFilteringExpressShipmentNotifier {
    reactorsFilteringShipmentDispatched(event: ReactorsFilteringShipmentDispatched): void {
        console.log(`Express shipment dispatched: ${event.trackingNumber}`);
    }
}
```
