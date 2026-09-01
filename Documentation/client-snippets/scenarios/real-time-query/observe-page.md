```typescript
import { IEventStore } from '@cratis/chronicle';

class ScenariosQueryLiveBookPage {
    constructor(private readonly store: IEventStore) {}

    async subscribe(updateView: (books: ScenariosQueryBook[]) => void): Promise<void> {
        for await (const page of this.store.readModels.materialized.observeInstances(ScenariosQueryBook, 0, 50)) {
            updateView(page);
        }
    }
}
```
