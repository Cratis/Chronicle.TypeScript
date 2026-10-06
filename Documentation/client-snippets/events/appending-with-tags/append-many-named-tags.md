```typescript
import { eventType, EventForEventSourceId, IEventStore, NamedTag } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class NamedTaggedMoneyWithdrawn {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

@eventType()
class NamedTaggedMoneyDeposited {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

class NamedTaggedTransferService {
    constructor(private readonly store: IEventStore) {}

    async transfer(fromAccountId: string, toAccountId: string, amount: number, transferId: string): Promise<void> {
        const events: EventForEventSourceId[] = [
            { eventSourceId: fromAccountId, event: new NamedTaggedMoneyWithdrawn(amount), namedTags: [new NamedTag('ledger-side', 'debit')] },
            { eventSourceId: toAccountId, event: new NamedTaggedMoneyDeposited(amount), namedTags: [new NamedTag('ledger-side', 'credit')] }
        ];

        // The withdrawal carries ledger-side = debit and transfer = <transferId>.
        // The deposit carries ledger-side = credit and transfer = <transferId>.
        await this.store.eventLog.appendMany(events, {
            namedTags: [new NamedTag('transfer', transferId)],
            tags: ['transfer']
        });
    }
}
```
