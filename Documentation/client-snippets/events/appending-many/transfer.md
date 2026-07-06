```typescript
import { eventType, EventForEventSourceId, IEventStore } from '@cratis/chronicle';

@eventType()
class MoneyWithdrawn {
    constructor(readonly amount: number) {}
}

@eventType()
class MoneyDeposited {
    constructor(readonly amount: number) {}
}

class TransferService {
    constructor(private readonly store: IEventStore) {}

    async transfer(fromAccount: string, toAccount: string, amount: number): Promise<void> {
        const events: EventForEventSourceId[] = [
            { eventSourceId: fromAccount, event: new MoneyWithdrawn(amount) },
            { eventSourceId: toAccount, event: new MoneyDeposited(amount) }
        ];

        const results = await this.store.eventLog.appendMany(events);

        if (results.some(_ => !_.isSuccess)) {
            // Decide whether to retry or surface a conflict to the caller.
        }
    }
}
```
