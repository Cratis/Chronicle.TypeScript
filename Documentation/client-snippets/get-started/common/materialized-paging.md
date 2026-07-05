```typescript
import { IEventStore } from '@cratis/chronicle';

class GetStartedBookPagingService {
    constructor(private readonly store: IEventStore) {}

    getPage(): Promise<GetStartedBook[]> {
        return this.store.readModels.materialized.getInstances(GetStartedBook, 0, 20);
    }
}
```
