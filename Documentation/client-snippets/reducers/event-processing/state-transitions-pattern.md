```typescript
import { EventContext, eventType, Guid, reducer } from '@cratis/chronicle';

@eventType()
class EventProcessingOrderCreatedForStatus {
    constructor(readonly orderId: Guid) {}
}

@eventType()
class EventProcessingOrderPaid {
    constructor(readonly orderId: Guid) {}
}

@eventType()
class EventProcessingOrderShipped {
    constructor(readonly orderId: Guid) {}
}

@eventType()
class EventProcessingOrderDelivered {
    constructor(readonly orderId: Guid) {}
}

@eventType()
class EventProcessingOrderCancelled {
    constructor(readonly orderId: Guid) {}
}

class EventProcessingOrderStatus {
    state = '';
    lastUpdated = new Date();
}

@reducer('', undefined, EventProcessingOrderStatus)
class EventProcessingOrderStatusReducer {
    eventProcessingOrderCreatedForStatus(event: EventProcessingOrderCreatedForStatus, current: EventProcessingOrderStatus | undefined, context: EventContext): EventProcessingOrderStatus {
        return { state: 'Created', lastUpdated: context.occurred };
    }

    eventProcessingOrderPaid(event: EventProcessingOrderPaid, current: EventProcessingOrderStatus | undefined, context: EventContext): EventProcessingOrderStatus {
        return { state: 'Paid', lastUpdated: context.occurred };
    }

    eventProcessingOrderShipped(event: EventProcessingOrderShipped, current: EventProcessingOrderStatus | undefined, context: EventContext): EventProcessingOrderStatus {
        return { state: 'Shipped', lastUpdated: context.occurred };
    }

    eventProcessingOrderDelivered(event: EventProcessingOrderDelivered, current: EventProcessingOrderStatus | undefined, context: EventContext): EventProcessingOrderStatus {
        return { state: 'Delivered', lastUpdated: context.occurred };
    }

    eventProcessingOrderCancelled(event: EventProcessingOrderCancelled, current: EventProcessingOrderStatus | undefined, context: EventContext): EventProcessingOrderStatus {
        return { state: 'Cancelled', lastUpdated: context.occurred };
    }
}
```
