```typescript
import { EventContext, eventType, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class MultipleSideEffectsBookReserved {
    @field(String) readonly isbn: string;

    constructor(isbn: string = '') {
        this.isbn = isbn;
    }
}

@eventType()
class MultipleSideEffectsStockDecreased {
    @field(String) readonly isbn: string;
    @field(Number) readonly quantity: number;

    constructor(isbn: string = '', quantity: number = 0) {
        this.isbn = isbn;
        this.quantity = quantity;
    }
}

@eventType()
class MultipleSideEffectsStockLow {
    @field(String) readonly isbn: string;

    constructor(isbn: string = '') {
        this.isbn = isbn;
    }
}

@reactor()
class MultipleSideEffectsInventoryReactor {
    // An array of events is appended together in one atomic AppendMany call - never
    // one append per item.
    @onceOnly()
    async multipleSideEffectsBookReserved(event: MultipleSideEffectsBookReserved, context: EventContext): Promise<object[]> {
        return [
            new MultipleSideEffectsStockDecreased(event.isbn, 1),
            new MultipleSideEffectsStockLow(event.isbn)
        ];
    }
}
```
