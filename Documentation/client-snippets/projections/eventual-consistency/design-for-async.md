```typescript
import { eventType, Guid, IEventStore } from '@cratis/chronicle';

@eventType()
class EcBookCreated {
    constructor(readonly title: string, readonly author: string) {}
}

class EcBookInventory {
    id: string = '';
    title: string = '';
    author: string = '';
}

class EcBookService {
    constructor(private readonly store: IEventStore) {}

    // Good — fire and forget: don't wait for the projection before returning
    async createBook(title: string, author: string): Promise<string> {
        const bookId = Guid.create().toString();
        await this.store.eventLog.append(bookId, new EcBookCreated(title, author));
        return bookId;
    }

    // Problematic — expecting immediate consistency
    async createBookAndReturn(title: string, author: string): Promise<EcBookInventory> {
        const bookId = Guid.create().toString();
        await this.store.eventLog.append(bookId, new EcBookCreated(title, author));

        // The projection may not have run yet — this can return a stale or default instance
        return this.store.readModels.getInstanceById(EcBookInventory, bookId);
    }
}
```
