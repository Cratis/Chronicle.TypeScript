```typescript title="Subtract from an event"
import { addFrom, eventType, fromEvent, setFrom, subtractFrom } from '@cratis/chronicle';

@eventType()
export class BalanceAccountOpened {
    constructor(readonly initialBalance: number) {}
}

@eventType()
export class BalanceDepositMade {
    constructor(readonly amount: number) {}
}

@eventType()
export class BalanceWithdrawalMade {
    constructor(readonly amount: number) {}
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
