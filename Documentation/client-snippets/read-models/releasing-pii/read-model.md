```typescript
import { EventContext, eventType, pii, reducer } from '@cratis/chronicle';

@eventType()
class ReleasingPiiSupportTicketOpened {
    constructor(readonly customerId: string, readonly requesterName: string) {}
}

class ReleasingPiiSupportTicket {
    // Read models are keyed by 'id' by convention - the same property release() uses as the subject.
    id = '';
    customerId = '';

    @pii('The name of the person who opened the ticket')
    requesterName = '';
}

@reducer('', undefined, ReleasingPiiSupportTicket)
class ReleasingPiiSupportTicketReducer {
    releasingPiiSupportTicketOpened(
        event: ReleasingPiiSupportTicketOpened,
        current: ReleasingPiiSupportTicket | undefined,
        context: EventContext
    ): ReleasingPiiSupportTicket {
        return { id: context.eventSourceId, customerId: event.customerId, requesterName: event.requesterName };
    }
}
```
