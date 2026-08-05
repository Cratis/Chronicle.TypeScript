```typescript
import { EventContext, eventType, reactor } from '@cratis/chronicle';

@eventType()
class ScenariosReactBookReserved {
    constructor(readonly isbn: string = '') {}
}

@eventType()
class ScenariosReactStockDecreased {
    constructor(readonly isbn: string = '', readonly quantity: number = 0) {}
}

@reactor()
class ScenariosReactStockKeeping {
    // Returning an event appends it for you, targeting the triggering event's own
    // event source id, stream, and subject - the simplest way to record a follow-up fact.
    async scenariosReactBookReserved(event: ScenariosReactBookReserved, context: EventContext): Promise<ScenariosReactStockDecreased> {
        return new ScenariosReactStockDecreased(event.isbn, 1);
    }
}
```
