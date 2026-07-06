```typescript
import { IEventStore } from '@cratis/chronicle';

class ScenariosQueryBook {
    constructor(
        readonly title: string,
        readonly onLoan: boolean
    ) {}
}

class ScenariosQueryBookService {
    constructor(private readonly store: IEventStore) {}

    async getBook(bookId: string): Promise<ScenariosQueryBook> {
        return this.store.readModels.getInstanceById(ScenariosQueryBook, bookId);
    }
}
```
