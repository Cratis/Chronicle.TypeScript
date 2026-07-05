```typescript
import { eventType, reducer } from '@cratis/chronicle';

@eventType()
class ReducersIndexDepositMade {
    amount = 0;
}

@eventType()
class ReducersIndexWithdrawalMade {
    amount = 0;
}

class ReducersIndexAccountBalance {
    balance = 0;
    lastUpdated: Date = new Date(0);
}

// Handler method names must be the exact camelCase of the event's class name -
// Chronicle discovers handlers by name, not by parameter type.
@reducer('', undefined, ReducersIndexAccountBalance)
class ReducersIndexAccountBalanceReducer {
    reducersIndexDepositMade(
        event: ReducersIndexDepositMade,
        current: ReducersIndexAccountBalance | undefined
    ): ReducersIndexAccountBalance {
        const currentBalance = current?.balance ?? 0;
        return { balance: currentBalance + event.amount, lastUpdated: new Date() };
    }

    reducersIndexWithdrawalMade(
        event: ReducersIndexWithdrawalMade,
        current: ReducersIndexAccountBalance | undefined
    ): ReducersIndexAccountBalance {
        const currentBalance = current?.balance ?? 0;
        return { balance: currentBalance - event.amount, lastUpdated: new Date() };
    }
}
```
