```typescript
import { eventType, Guid, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class EcBookCreated {
    @field(String) readonly title: string;
    @field(String) readonly author: string;

    constructor(title: string, author: string) {
        this.title = title;
        this.author = author;
    }
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
    async createBookAndReturn(title: string, author: string): Promise<EcBookInventory | null> {
        const bookId = Guid.create().toString();
        await this.store.eventLog.append(bookId, new EcBookCreated(title, author));

        // The projection may not have run yet — this can return null
        return this.store.readModels.findInstanceById(EcBookInventory, bookId);
    }
}
```
