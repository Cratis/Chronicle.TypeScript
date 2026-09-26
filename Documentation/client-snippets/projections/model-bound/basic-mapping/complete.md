```typescript title="Complete balance projection"
import { addFrom, eventType, fromEvent, setFrom, subtractFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class BankAccountOpened {
    @field(String) readonly accountName: string;
    @field(Number) readonly initialBalance: number;

    constructor(accountName: string, initialBalance: number) {
        this.accountName = accountName;
        this.initialBalance = initialBalance;
    }
}

@eventType()
export class BankAccountRenamed {
    @field(String) readonly newName: string;

    constructor(newName: string) {
        this.newName = newName;
    }
}

@eventType()
export class FundsDeposited {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

@eventType()
export class FundsWithdrawn {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
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
