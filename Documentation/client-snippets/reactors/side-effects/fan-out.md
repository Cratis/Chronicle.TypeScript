```typescript
import { EventContext, EventForEventSourceId, eventType, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class FanOutBookReserved {
    @field(String) readonly isbn: string;
    @field(String) readonly memberId: string;

    constructor(isbn: string = '', memberId: string = '') {
        this.isbn = isbn;
        this.memberId = memberId;
    }
}

@eventType()
class FanOutMemberActivityRecorded {
    @field(String) readonly isbn: string;

    constructor(isbn: string = '') {
        this.isbn = isbn;
    }
}

@eventType()
class FanOutStockDecreased {
    @field(String) readonly isbn: string;
    @field(Number) readonly quantity: number;

    constructor(isbn: string = '', quantity: number = 0) {
        this.isbn = isbn;
        this.quantity = quantity;
    }
}

@reactor()
class ReservationFanOutReactor {
    @onceOnly()
    async fanOutBookReserved(event: FanOutBookReserved, context: EventContext): Promise<EventForEventSourceId[]> {
        return [
            { eventSourceId: event.memberId, event: new FanOutMemberActivityRecorded(event.isbn) },
            { eventSourceId: event.isbn, event: new FanOutStockDecreased(event.isbn, 1) }
        ];
    }
}
```
