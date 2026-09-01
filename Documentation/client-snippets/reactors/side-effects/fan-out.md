```typescript
import { EventContext, EventForEventSourceId, eventType, reactor } from '@cratis/chronicle';

@eventType()
class FanOutBookReserved {
    constructor(readonly isbn: string = '', readonly memberId: string = '') {}
}

@eventType()
class FanOutMemberActivityRecorded {
    constructor(readonly isbn: string = '') {}
}

@eventType()
class FanOutStockDecreased {
    constructor(readonly isbn: string = '', readonly quantity: number = 0) {}
}

@reactor()
class ReservationFanOutReactor {
    async fanOutBookReserved(event: FanOutBookReserved, context: EventContext): Promise<EventForEventSourceId[]> {
        return [
            { eventSourceId: event.memberId, event: new FanOutMemberActivityRecorded(event.isbn) },
            { eventSourceId: event.isbn, event: new FanOutStockDecreased(event.isbn, 1) }
        ];
    }
}
```
