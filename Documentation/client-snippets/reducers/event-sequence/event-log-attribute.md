```typescript
import { EventContext, eventType, Guid, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EventSequenceLogOrderPlaced {
    @field(Guid) readonly orderId: Guid;

    constructor(orderId: Guid) {
        this.orderId = orderId;
    }
}

class EventSequenceLogOrderAudit {
    orderId: Guid = Guid.empty;
}

// No eventSequenceId given - observes the default event log
@reducer('', undefined, EventSequenceLogOrderAudit)
class EventSequenceLocalAuditReducer {
    eventSequenceLogOrderPlaced(
        event: EventSequenceLogOrderPlaced,
        current: EventSequenceLogOrderAudit | undefined,
        context: EventContext
    ): EventSequenceLogOrderAudit {
        return { orderId: event.orderId };
    }
}
```
