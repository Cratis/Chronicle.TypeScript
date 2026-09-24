```typescript title="Add from an event"
import { addFrom, eventType, fromEvent, setFrom } from '@cratis/chronicle';

@eventType()
export class AccountOpenedForDeposits {
    constructor(readonly initialBalance: number) {}
}

@eventType()
export class DepositMadeForBalance {
    constructor(readonly amount: number) {}
}

@fromEvent(AccountOpenedForDeposits)
@fromEvent(DepositMadeForBalance)
export class DepositAccount {
    @setFrom(AccountOpenedForDeposits, 'initialBalance')
    @addFrom(DepositMadeForBalance, 'amount')
    balance = 0;
}
```
