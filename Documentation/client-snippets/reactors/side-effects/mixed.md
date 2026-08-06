```typescript
import { EventContext, EventForEventSourceId, eventType, reactor } from '@cratis/chronicle';

@eventType()
class MixedBookReserved {
    constructor(readonly isbn: string = '', readonly memberId: string = '') {}
}

@eventType()
class MixedActivityLogged {
    constructor(readonly isbn: string = '') {}
}

@eventType()
class MixedMemberActivityRecorded {
    constructor(readonly isbn: string = '') {}
}

@reactor()
class MixedSideEffectsReactor {
    // A bare event uses the triggering event's own target; an EventForEventSourceId
    // entry keeps its own explicit target - both can be returned together, in one
    // atomic AppendMany call.
    async mixedBookReserved(event: MixedBookReserved, context: EventContext): Promise<Array<object | EventForEventSourceId>> {
        return [
            new MixedActivityLogged(event.isbn),
            { eventSourceId: event.memberId, event: new MixedMemberActivityRecorded(event.isbn) }
        ];
    }
}
```
