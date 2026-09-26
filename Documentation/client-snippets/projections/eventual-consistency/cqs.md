```typescript
import { eventType, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EcCqsBookCreated {
    @field(String) readonly title: string;

    constructor(title: string) {
        this.title = title;
    }
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

    getBook(bookId: string): Promise<EcCqsBook | null> {
        return this.store.readModels.findInstanceById(EcCqsBook, bookId);
    }
}
```
