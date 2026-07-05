```typescript title="Subtract from an event"
import { addFrom, eventType, fromEvent, readModel, setFrom, subtractFrom } from '@cratis/chronicle';

@eventType()
class BalanceAccountOpened {
    constructor(readonly initialBalance: number) {}
}

@eventType()
class BalanceDepositMade {
    constructor(readonly amount: number) {}
}

@eventType()
class BalanceWithdrawalMade {
    constructor(readonly amount: number) {}
}

@readModel()
@fromEvent(BalanceAccountOpened)
@fromEvent(BalanceDepositMade)
@fromEvent(BalanceWithdrawalMade)
class BalanceAccount {
    @setFrom(BalanceAccountOpened, 'initialBalance')
    @addFrom(BalanceDepositMade, 'amount')
    @subtractFrom(BalanceWithdrawalMade, 'amount')
    balance = 0;
}
```
