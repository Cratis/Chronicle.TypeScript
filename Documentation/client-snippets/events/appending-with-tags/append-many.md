```typescript
import { eventType, EventForEventSourceId, IEventStore } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class TaggedMoneyWithdrawn {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

@eventType()
class TaggedMoneyDeposited {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
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
