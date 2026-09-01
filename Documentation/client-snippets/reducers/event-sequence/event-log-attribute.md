```typescript
import { EventContext, eventType, Guid, reducer } from '@cratis/chronicle';

@eventType()
class EventSequenceLogOrderPlaced {
    constructor(readonly orderId: Guid) {}
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
