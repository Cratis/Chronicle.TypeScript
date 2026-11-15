```typescript
import { eventSourceType, eventType, IEventStore, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class FilterBySourceTypeDepositMade {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

class FilterBySourceTypeAccountBalance {
    balance = 0;
}

@reducer('', undefined, FilterBySourceTypeAccountBalance)
@eventSourceType('account')
class FilterBySourceTypeAccountBalanceReducer {
    filterBySourceTypeDepositMade(
        event: FilterBySourceTypeDepositMade,
        current: FilterBySourceTypeAccountBalance | undefined
    ): FilterBySourceTypeAccountBalance {
        return { balance: (current?.balance ?? 0) + event.amount };
    }
}

class FilterBySourceTypeDepositService {
    constructor(private readonly store: IEventStore) {}

    async deposit(eventSourceId: string, amount: number): Promise<void> {
        await this.store.eventLog.append(
            eventSourceId,
            new FilterBySourceTypeDepositMade(amount),
            { sourceType: 'account' });
    }
}
```
