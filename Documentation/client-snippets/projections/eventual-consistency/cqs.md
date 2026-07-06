```typescript
import { eventType, IEventStore } from '@cratis/chronicle';

@eventType()
class EcCqsBookCreated {
    constructor(readonly title: string) {}
}

class EcCqsBook {
    id: string = '';
    title: string = '';
}

// Commands — fire and forget, never return projected state
class EcCqsBookCommandHandler {
    constructor(private readonly store: IEventStore) {}

    create(bookId: string, title: string): Promise<void> {
        return this.store.eventLog.append(bookId, new EcCqsBookCreated(title)).then(() => undefined);
    }
}

// Queries — always read from projections
class EcCqsBookQueryHandler {
    constructor(private readonly store: IEventStore) {}

    getBook(bookId: string): Promise<EcCqsBook> {
        return this.store.readModels.getInstanceById(EcCqsBook, bookId);
    }
}
```
