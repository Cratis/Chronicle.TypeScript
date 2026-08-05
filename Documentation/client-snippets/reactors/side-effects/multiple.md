```typescript
import { EventContext, eventType, reactor } from '@cratis/chronicle';

@eventType()
class MultipleSideEffectsBookReserved {
    constructor(readonly isbn: string = '') {}
}

@eventType()
class MultipleSideEffectsStockDecreased {
    constructor(readonly isbn: string = '', readonly quantity: number = 0) {}
}

@eventType()
class MultipleSideEffectsStockLow {
    constructor(readonly isbn: string = '') {}
}

@reactor()
class MultipleSideEffectsInventoryReactor {
    // An array of events is appended together in one atomic AppendMany call - never
    // one append per item.
    async multipleSideEffectsBookReserved(event: MultipleSideEffectsBookReserved, context: EventContext): Promise<object[]> {
        return [
            new MultipleSideEffectsStockDecreased(event.isbn, 1),
            new MultipleSideEffectsStockLow(event.isbn)
        ];
    }
}
```
