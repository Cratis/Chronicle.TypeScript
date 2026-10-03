```typescript
import { ConcurrencyDimensions, eventSource, eventStream, eventType, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventSource({ name: 'Account', description: 'A bank account', concurrency: ConcurrencyDimensions.eventSourceId })
@eventStream('Transactions', { description: 'Money movements' })
class AccountEventSource {}

@eventSource({ name: 'Customer' })
class CustomerEventSource {}

@eventType()
class AccountFundsDeposited {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

async function deposit(log: IEventLog, accountId: string, amount: number) {
    return log.append(accountId, new AccountFundsDeposited(amount), {
        eventSource: AccountEventSource,
        eventStream: 'Transactions',
        streamId: 'transfer-1'
    });
}

async function depositAcrossSources(log: IEventLog, accountId: string, customerId: string) {
    return log.appendMany([
        { eventSourceId: accountId, event: new AccountFundsDeposited(10) },
        { eventSourceId: customerId, event: new AccountFundsDeposited(1), eventSource: CustomerEventSource }
    ], { eventSource: AccountEventSource, eventStream: 'Transactions' });
}
```
