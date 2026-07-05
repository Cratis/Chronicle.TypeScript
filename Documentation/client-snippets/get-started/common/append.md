```typescript
import { IEventStore } from '@cratis/chronicle';

class GetStartedBookService {
    constructor(private readonly store: IEventStore) {}

    async addBook(bookId: string): Promise<void> {
        const eventLog = this.store.eventLog;

        await eventLog.append(bookId, new GetStartedBookAdded('The Pragmatic Programmer', '978-0135957059'));
    }
}
```
