```typescript
import { IEventStore } from '@cratis/chronicle';

class GetStartedBookQueryService {
    constructor(private readonly store: IEventStore) {}

    async queryBooks(): Promise<{ books: GetStartedBook[]; borrowedBooks: GetStartedBorrowedBook[] }> {
        const books = await this.store.readModels.getInstances(GetStartedBook);
        const borrowedBooks = await this.store.readModels.getInstances(GetStartedBorrowedBook);

        return { books, borrowedBooks };
    }
}
```
