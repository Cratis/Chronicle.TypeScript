```typescript title="Add from an event"
import { addFrom, eventType, fromEvent, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class AccountOpenedForDeposits {
    constructor(readonly initialBalance: number) {}
}

@eventType()
class DepositMadeForBalance {
    constructor(readonly amount: number) {}
}

@readModel()
@fromEvent(AccountOpenedForDeposits)
@fromEvent(DepositMadeForBalance)
class DepositAccount {
    @setFrom(AccountOpenedForDeposits, 'initialBalance')
    @addFrom(DepositMadeForBalance, 'amount')
    balance = 0;
}
```
