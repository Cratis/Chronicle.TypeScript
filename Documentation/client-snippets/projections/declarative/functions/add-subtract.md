```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecFunctionsAccountOpened {
    constructor(readonly number: string) {}
}

@eventType()
class DecFunctionsMoneyDeposited {
    constructor(readonly amount: number) {}
}

@eventType()
class DecFunctionsMoneyWithdrawn {
    constructor(readonly amount: number) {}
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
