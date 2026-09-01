```typescript
import { IEventStore } from '@cratis/chronicle';

class BorrowedBooks {
    constructor(private readonly store: IEventStore) {}

    all(): Promise<BorrowedBook[]> {
        return this.store.readModels.getInstances(BorrowedBook);
    }
}
```
