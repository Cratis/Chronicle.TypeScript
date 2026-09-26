```typescript
import { eventType, EventForEventSourceId, getEventTypeFor, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConcurrencyMoneyWithdrawnForTransfer {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

@eventType()
class ConcurrencyMoneyDepositedForTransfer {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

class ConcurrencyTransferService {
    constructor(private readonly eventLog: IEventLog) {}

    async transferMoney(fromAccount: string, toAccount: string, amount: number): Promise<void> {
        const events: EventForEventSourceId[] = [
            { eventSourceId: fromAccount, event: new ConcurrencyMoneyWithdrawnForTransfer(amount) },
            { eventSourceId: toAccount, event: new ConcurrencyMoneyDepositedForTransfer(amount) }
        ];

        await this.eventLog.appendMany(events, {
            concurrencyScopes: {
                [fromAccount]: {
                    sequenceNumber: 50n,
                    eventTypes: [getEventTypeFor(ConcurrencyMoneyWithdrawnForTransfer)]
                },
                [toAccount]: {
                    sequenceNumber: 25n,
                    eventTypes: [getEventTypeFor(ConcurrencyMoneyDepositedForTransfer)]
                }
            }
        });
    }
}
```
