```typescript
import { EventContext, eventType, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class SideEffectsBookReserved {
    @field(String) readonly isbn: string;

    constructor(isbn: string = '') {
        this.isbn = isbn;
    }
}

@eventType()
class SideEffectsStockDecreased {
    @field(String) readonly isbn: string;
    @field(Number) readonly quantity: number;

    constructor(isbn: string = '', quantity: number = 0) {
        this.isbn = isbn;
        this.quantity = quantity;
    }
}

@reactor()
class SideEffectsWarehouseReactor {
    // Returning an event from a handler appends it for you, targeting the triggering
    // event's own event source id, stream, and subject.
    @onceOnly()
    async sideEffectsBookReserved(event: SideEffectsBookReserved, context: EventContext): Promise<SideEffectsStockDecreased> {
        return new SideEffectsStockDecreased(event.isbn, 1);
    }
}
```
