```typescript
import { EventContext, eventType, Guid, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EventProcessingOrderCreatedForStatus {
    @field(Guid) readonly orderId: Guid;

    constructor(orderId: Guid) {
        this.orderId = orderId;
    }
}

@eventType()
class EventProcessingOrderPaid {
    @field(Guid) readonly orderId: Guid;

    constructor(orderId: Guid) {
        this.orderId = orderId;
    }
}

@eventType()
class EventProcessingOrderShipped {
    @field(Guid) readonly orderId: Guid;

    constructor(orderId: Guid) {
        this.orderId = orderId;
    }
}

@eventType()
class EventProcessingOrderDelivered {
    @field(Guid) readonly orderId: Guid;

    constructor(orderId: Guid) {
        this.orderId = orderId;
    }
}

@eventType()
class EventProcessingOrderCancelled {
    @field(Guid) readonly orderId: Guid;

    constructor(orderId: Guid) {
        this.orderId = orderId;
    }
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
