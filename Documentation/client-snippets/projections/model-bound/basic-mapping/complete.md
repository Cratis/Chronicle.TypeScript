```typescript title="Complete balance projection"
import { addFrom, eventType, fromEvent, readModel, setFrom, subtractFrom } from '@cratis/chronicle';

@eventType()
class BankAccountOpened {
    constructor(readonly accountName: string, readonly initialBalance: number) {}
}

@eventType()
class BankAccountRenamed {
    constructor(readonly newName: string) {}
}

@eventType()
class FundsDeposited {
    constructor(readonly amount: number) {}
}

@eventType()
class FundsWithdrawn {
    constructor(readonly amount: number) {}
}

@readModel()
@fromEvent(BankAccountOpened)
@fromEvent(BankAccountRenamed)
@fromEvent(FundsDeposited)
@fromEvent(FundsWithdrawn)
class BankAccount {
    @setFrom(BankAccountOpened, 'accountName')
    @setFrom(BankAccountRenamed, 'newName')
    name = '';

    @setFrom(BankAccountOpened, 'initialBalance')
    @addFrom(FundsDeposited, 'amount')
    @subtractFrom(FundsWithdrawn, 'amount')
    balance = 0;
}
```
