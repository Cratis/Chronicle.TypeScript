```typescript
import { EventContext, eventType, reducer } from '@cratis/chronicle';

@eventType()
class PassiveReducersTransactionCompleted {
    constructor(readonly amount: number) {}
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
