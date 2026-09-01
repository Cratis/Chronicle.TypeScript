```typescript
import { IEventStore } from '@cratis/chronicle';

class Books {
    constructor(private readonly store: IEventStore) {}

    async onLoan(): Promise<Book[]> {
        const books = await this.store.readModels.getInstances(Book);
        return books.filter(book => book.onLoan);
    }
}
```
