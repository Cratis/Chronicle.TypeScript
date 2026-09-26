```typescript title="Subtract from an event"
import { addFrom, eventType, fromEvent, setFrom, subtractFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class BalanceAccountOpened {
    @field(Number) readonly initialBalance: number;

    constructor(initialBalance: number) {
        this.initialBalance = initialBalance;
    }
}

@eventType()
export class BalanceDepositMade {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

@eventType()
export class BalanceWithdrawalMade {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

@fromEvent(BalanceAccountOpened)
@fromEvent(BalanceDepositMade)
@fromEvent(BalanceWithdrawalMade)
export class BalanceAccount {
    @setFrom(BalanceAccountOpened, 'initialBalance')
    @addFrom(BalanceDepositMade, 'amount')
    @subtractFrom(BalanceWithdrawalMade, 'amount')
    balance = 0;
}
```
