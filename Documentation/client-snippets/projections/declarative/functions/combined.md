```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class DecFunctionsTransaction {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
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
