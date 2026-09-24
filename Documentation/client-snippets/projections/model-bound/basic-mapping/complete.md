```typescript title="Complete balance projection"
import { addFrom, eventType, fromEvent, setFrom, subtractFrom } from '@cratis/chronicle';

@eventType()
export class BankAccountOpened {
    constructor(readonly accountName: string, readonly initialBalance: number) {}
}

@eventType()
export class BankAccountRenamed {
    constructor(readonly newName: string) {}
}

@eventType()
export class FundsDeposited {
    constructor(readonly amount: number) {}
}

@eventType()
export class FundsWithdrawn {
    constructor(readonly amount: number) {}
}

@fromEvent(BankAccountOpened)
@fromEvent(BankAccountRenamed)
@fromEvent(FundsDeposited)
@fromEvent(FundsWithdrawn)
export class BankAccount {
    @setFrom(BankAccountOpened, 'accountName')
    @setFrom(BankAccountRenamed, 'newName')
    name = '';

    @setFrom(BankAccountOpened, 'initialBalance')
    @addFrom(FundsDeposited, 'amount')
    @subtractFrom(FundsWithdrawn, 'amount')
    balance = 0;
}
```
