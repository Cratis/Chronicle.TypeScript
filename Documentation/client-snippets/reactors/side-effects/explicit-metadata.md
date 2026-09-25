```typescript
import { EventContext, EventForEventSourceId, eventType, onceOnly, reactor } from '@cratis/chronicle';

@eventType()
class ExplicitMetadataBookReserved {
    constructor(readonly isbn: string = '', readonly memberId: string = '') {}
}

@eventType()
class ExplicitMetadataMemberActivityRecorded {
    constructor(readonly isbn: string = '') {}
}

@reactor()
class ExplicitMetadataReactor {
    @onceOnly()
    async explicitMetadataBookReserved(event: ExplicitMetadataBookReserved, context: EventContext): Promise<EventForEventSourceId> {
        return {
            eventSourceId: event.memberId,
            event: new ExplicitMetadataMemberActivityRecorded(event.isbn),
            eventStreamType: 'members',
            subject: event.memberId
        };
    }
}
```
