```typescript
import { eventType, reducer } from '@cratis/chronicle';

@eventType()
class ReducersEventSequenceReducerAttributeShipmentDispatched {
    trackingNumber = '';
    carrier = '';
}

class ReducersEventSequenceReducerAttributeShipmentSummary {
    trackingNumber = '';
    carrier = '';
    dispatchedAt: Date = new Date(0);
}

@reducer('shipment-summary', 'fulfillment-events', ReducersEventSequenceReducerAttributeShipmentSummary)
class ReducersEventSequenceReducerAttributeShipmentSummaryReducer {
    // Method name must be the exact camelCase of the event's class name
    reducersEventSequenceReducerAttributeShipmentDispatched(
        event: ReducersEventSequenceReducerAttributeShipmentDispatched,
        _current: ReducersEventSequenceReducerAttributeShipmentSummary | undefined
    ): ReducersEventSequenceReducerAttributeShipmentSummary {
        return { trackingNumber: event.trackingNumber, carrier: event.carrier, dispatchedAt: new Date() };
    }
}
```
