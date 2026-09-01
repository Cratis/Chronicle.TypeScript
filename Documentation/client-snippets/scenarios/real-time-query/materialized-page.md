```typescript
import { IEventStore } from '@cratis/chronicle';

class ScenariosQueryBookPageService {
    constructor(private readonly store: IEventStore) {}

    getPage(): Promise<ScenariosQueryBook[]> {
        return this.store.readModels.materialized.getInstances(ScenariosQueryBook, 0, 20);
    }
}
```
