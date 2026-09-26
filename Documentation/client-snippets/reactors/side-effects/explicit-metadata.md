```typescript
import { EventContext, EventForEventSourceId, eventType, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ExplicitMetadataBookReserved {
    @field(String) readonly isbn: string;
    @field(String) readonly memberId: string;

    constructor(isbn: string = '', memberId: string = '') {
        this.isbn = isbn;
        this.memberId = memberId;
    }
}

@eventType()
class ExplicitMetadataMemberActivityRecorded {
    @field(String) readonly isbn: string;

    constructor(isbn: string = '') {
        this.isbn = isbn;
    }
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
