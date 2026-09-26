```typescript
import { EventContext, EventForEventSourceId, eventType, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class MixedBookReserved {
    @field(String) readonly isbn: string;
    @field(String) readonly memberId: string;

    constructor(isbn: string = '', memberId: string = '') {
        this.isbn = isbn;
        this.memberId = memberId;
    }
}

@eventType()
class MixedActivityLogged {
    @field(String) readonly isbn: string;

    constructor(isbn: string = '') {
        this.isbn = isbn;
    }
}

@eventType()
class MixedMemberActivityRecorded {
    @field(String) readonly isbn: string;

    constructor(isbn: string = '') {
        this.isbn = isbn;
    }
}

@reactor()
class MixedSideEffectsReactor {
    // A bare event uses the triggering event's own target; an EventForEventSourceId
    // entry keeps its own explicit target - both can be returned together, in one
    // atomic AppendMany call.
    @onceOnly()
    async mixedBookReserved(event: MixedBookReserved, context: EventContext): Promise<Array<object | EventForEventSourceId>> {
        return [
            new MixedActivityLogged(event.isbn),
            { eventSourceId: event.memberId, event: new MixedMemberActivityRecorded(event.isbn) }
        ];
    }
}
```
