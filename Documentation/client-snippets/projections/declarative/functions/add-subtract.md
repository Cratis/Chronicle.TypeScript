```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class DecFunctionsAccountOpened {
    @field(String) readonly number: string;

    constructor(number: string) {
        this.number = number;
    }
}

@eventType()
class DecFunctionsMoneyDeposited {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

@eventType()
class DecFunctionsMoneyWithdrawn {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

class DecFunctionsAccount {
    number = '';
    balance = 0;
}

@projection()
class DecFunctionsAccountProjection implements IProjectionFor<DecFunctionsAccount> {
    define(builder: IProjectionBuilderFor<DecFunctionsAccount>): void {
        builder
            .autoMap()
            .from(DecFunctionsAccountOpened, _ => _
                .set(m => m.balance).toValue(0))
            .from(DecFunctionsMoneyDeposited, _ => _
                .add(m => m.balance).with(e => e.amount))
            .from(DecFunctionsMoneyWithdrawn, _ => _
                .subtract(m => m.balance).with(e => e.amount));
    }
}
```
