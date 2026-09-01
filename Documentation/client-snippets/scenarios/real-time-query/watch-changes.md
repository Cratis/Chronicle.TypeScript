```typescript
import { IEventStore } from '@cratis/chronicle';

class ScenariosQueryBookWatcher {
    constructor(private readonly store: IEventStore) {}

    async watch(): Promise<void> {
        for await (const changeset of this.store.readModels.watch(ScenariosQueryBook)) {
            if (changeset.removed) {
                continue;
            }

            console.log(`${changeset.key}: on loan = ${changeset.readModel.onLoan}`);
        }
    }
}
```
