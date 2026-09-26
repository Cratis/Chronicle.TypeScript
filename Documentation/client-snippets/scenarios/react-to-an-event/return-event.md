```typescript
import { EventContext, eventType, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ScenariosReactBookReserved {
    @field(String) readonly isbn: string;

    constructor(isbn: string = '') {
        this.isbn = isbn;
    }
}

@eventType()
class ScenariosReactStockDecreased {
    @field(String) readonly isbn: string;
    @field(Number) readonly quantity: number;

    constructor(isbn: string = '', quantity: number = 0) {
        this.isbn = isbn;
        this.quantity = quantity;
    }
}

@reactor()
class ScenariosReactStockKeeping {
    // Without @onceOnly(), a replay of this reactor appends StockDecreased again.
    // Returning an event appends it for you, targeting the triggering event's own
    // event source id, stream, and subject - the simplest way to record a follow-up fact.
    @onceOnly()
    async scenariosReactBookReserved(event: ScenariosReactBookReserved, context: EventContext): Promise<ScenariosReactStockDecreased> {
        return new ScenariosReactStockDecreased(event.isbn, 1);
    }
}
```
