```typescript
import { EventContext, EventForEventSourceId, eventType, reactor } from '@cratis/chronicle';

@eventType()
class SpecificSourceBookReserved {
    constructor(readonly isbn: string = '', readonly memberId: string = '') {}
}

@eventType()
class SpecificSourceMemberActivityRecorded {
    constructor(readonly isbn: string = '') {}
}

@reactor()
class SpecificSourceReservationReactor {
    // Returning an EventForEventSourceId targets a different event source than the one
    // that triggered the reactor - here, the member's own stream rather than the book's.
    async specificSourceBookReserved(event: SpecificSourceBookReserved, context: EventContext): Promise<EventForEventSourceId> {
        return {
            eventSourceId: event.memberId,
            event: new SpecificSourceMemberActivityRecorded(event.isbn)
        };
    }
}
```
