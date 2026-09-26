```typescript
import { eventType, getEventTypeFor, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ConcurrencyMoneyDeposited {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

@eventType()
class ConcurrencyMoneyWithdrawn {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
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
