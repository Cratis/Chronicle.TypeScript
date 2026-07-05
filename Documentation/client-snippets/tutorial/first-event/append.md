```typescript
import { Guid, IEventStore } from '@cratis/chronicle';

class TutorialFirstEventAppend {
    async addBook(eventStore: IEventStore): Promise<string> {
        const bookId = Guid.create().toString();
        await eventStore.eventLog.append(bookId, new BookAdded('The Pragmatic Programmer', '978-0135957059'));
        return bookId;
    }
}
```
