```typescript
import { eventType, getEventTypeFor, IEventLog } from '@cratis/chronicle';

@eventType()
class ConcurrencyMoneyDeposited {
    constructor(readonly amount: number) {}
}

@eventType()
class ConcurrencyMoneyWithdrawn {
    constructor(readonly amount: number) {}
}

class ConcurrencyAccountTransactionService {
    constructor(private readonly eventLog: IEventLog) {}

    async processTransaction(accountId: string, amount: number): Promise<void> {
        await this.eventLog.append(accountId, new ConcurrencyMoneyDeposited(amount), {
            concurrencyScope: {
                sequenceNumber: 15n,
                eventStreamType: 'Transactions',
                eventTypes: [getEventTypeFor(ConcurrencyMoneyDeposited), getEventTypeFor(ConcurrencyMoneyWithdrawn)]
            }
        });
    }
}
```
