```typescript
import { EventContext, eventType, pii, reducer, subject } from '@cratis/chronicle';

@eventType()
class ReleasingPiiSupportTicketOpened {
    constructor(readonly customerId: string, readonly requesterName: string) {}
}

class ReleasingPiiSupportTicket {
    // The ticket's own id identifies the ticket, not the person the PII belongs to - @subject()
    // tells release() to use customerId as the encryption key's owner instead. Without it,
    // release() would fall back to id.
    id = '';

    @subject()
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
