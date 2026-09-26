```typescript title="Add from an event"
import { addFrom, eventType, fromEvent, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class AccountOpenedForDeposits {
    @field(Number) readonly initialBalance: number;

    constructor(initialBalance: number) {
        this.initialBalance = initialBalance;
    }
}

@eventType()
export class DepositMadeForBalance {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

@fromEvent(AccountOpenedForDeposits)
@fromEvent(DepositMadeForBalance)
export class DepositAccount {
    @setFrom(AccountOpenedForDeposits, 'initialBalance')
    @addFrom(DepositMadeForBalance, 'amount')
    balance = 0;
}
```
