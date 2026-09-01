```typescript
import { eventType, EventForEventSourceId, IEventStore } from '@cratis/chronicle';

@eventType()
class TaggedMoneyWithdrawn {
    constructor(readonly amount: number) {}
}

@eventType()
class TaggedMoneyDeposited {
    constructor(readonly amount: number) {}
}

class TaggedTransferService {
    constructor(private readonly store: IEventStore) {}

    async transfer(fromAccountId: string, toAccountId: string, amount: number): Promise<void> {
        const events: EventForEventSourceId[] = [
            { eventSourceId: fromAccountId, event: new TaggedMoneyWithdrawn(amount) },
            { eventSourceId: toAccountId, event: new TaggedMoneyDeposited(amount) }
        ];

        await this.store.eventLog.appendMany(events, { tags: ['transfer', 'audit'] });
    }
}
```
