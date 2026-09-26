```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class PassiveReducersTransactionCompleted {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

class PassiveReducersAdHocReport {
    totalRevenue = 0;
    transactionCount = 0;
    generatedAt = new Date();
}

@reducer('', undefined, PassiveReducersAdHocReport, false)
class PassiveReducersAdHocReportReducer {
    passiveReducersTransactionCompleted(
        event: PassiveReducersTransactionCompleted,
        current: PassiveReducersAdHocReport | undefined,
        context: EventContext
    ): PassiveReducersAdHocReport {
        const revenue = current?.totalRevenue ?? 0;
        const count = current?.transactionCount ?? 0;

        return { totalRevenue: revenue + event.amount, transactionCount: count + 1, generatedAt: context.occurred };
    }
}
```
