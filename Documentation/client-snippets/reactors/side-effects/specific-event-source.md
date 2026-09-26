```typescript
import { EventContext, EventForEventSourceId, eventType, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SpecificSourceBookReserved {
    @field(String) readonly isbn: string;
    @field(String) readonly memberId: string;

    constructor(isbn: string = '', memberId: string = '') {
        this.isbn = isbn;
        this.memberId = memberId;
    }
}

@eventType()
class SpecificSourceMemberActivityRecorded {
    @field(String) readonly isbn: string;

    constructor(isbn: string = '') {
        this.isbn = isbn;
    }
}

@reactor()
class SpecificSourceReservationReactor {
    // Returning an EventForEventSourceId targets a different event source than the one
    // that triggered the reactor - here, the member's own stream rather than the book's.
    @onceOnly()
    async specificSourceBookReserved(event: SpecificSourceBookReserved, context: EventContext): Promise<EventForEventSourceId> {
        return {
            eventSourceId: event.memberId,
            event: new SpecificSourceMemberActivityRecorded(event.isbn)
        };
    }
}
```
