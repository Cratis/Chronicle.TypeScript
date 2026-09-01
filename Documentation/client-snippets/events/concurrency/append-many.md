```typescript
import { eventType, EventForEventSourceId, getEventTypeFor, IEventLog } from '@cratis/chronicle';

@eventType()
class ConcurrencyMoneyWithdrawnForTransfer {
    constructor(readonly amount: number) {}
}

@eventType()
class ConcurrencyMoneyDepositedForTransfer {
    constructor(readonly amount: number) {}
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
