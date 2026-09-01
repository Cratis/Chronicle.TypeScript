```typescript
import { IEventStore } from '@cratis/chronicle';

class ScenariosQueryOnLoanBooks {
    constructor(private readonly store: IEventStore) {}

    async getOnLoan(): Promise<ScenariosQueryBook[]> {
        const books = await this.store.readModels.getInstances(ScenariosQueryBook);
        return books.filter(book => book.onLoan);
    }
}
```
