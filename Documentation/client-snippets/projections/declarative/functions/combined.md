```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecFunctionsTransaction {
    constructor(readonly amount: number) {}
}

class DecFunctionsTransactionSummary {
    transactionCount = 0;
    totalAmount = 0;
    processedEvents = 0;
}

@projection()
class DecFunctionsTransactionSummaryProjection implements IProjectionFor<DecFunctionsTransactionSummary> {
    define(builder: IProjectionBuilderFor<DecFunctionsTransactionSummary>): void {
        builder
            .from(DecFunctionsTransaction, _ => _
                .count(m => m.transactionCount)
                .add(m => m.totalAmount).with(e => e.amount)
                .increment(m => m.processedEvents));
    }
}
```
