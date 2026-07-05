```typescript
import { EventSequenceNumber, IEventStore } from '@cratis/chronicle';

class GettingStateCheckpointStore {
    constructor(private readonly store: IEventStore) {}

    async captureTail(): Promise<EventSequenceNumber> {
        // Persists the current tail so processing can resume later.
        return await this.store.eventLog.getTailSequenceNumber();
    }
}
```
