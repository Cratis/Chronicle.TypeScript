```typescript
import { EventContext, eventType, reactor } from '@cratis/chronicle';

@eventType()
class SideEffectsBookReserved {
    constructor(readonly isbn: string = '') {}
}

@eventType()
class SideEffectsStockDecreased {
    constructor(readonly isbn: string = '', readonly quantity: number = 0) {}
}

@reactor()
class SideEffectsWarehouseReactor {
    // Returning an event from a handler appends it for you, targeting the triggering
    // event's own event source id, stream, and subject.
    async sideEffectsBookReserved(event: SideEffectsBookReserved, context: EventContext): Promise<SideEffectsStockDecreased> {
        return new SideEffectsStockDecreased(event.isbn, 1);
    }
}
```
