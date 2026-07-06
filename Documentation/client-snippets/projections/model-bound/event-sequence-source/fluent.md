```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class MbEventSeqFluentOrderPlaced {
    amount = 0;
}

// The event sequence is configured on the decorator rather than the builder
@projection('', undefined, 'custom-sequence')
class MbEventSeqFluentOrderProjection implements IProjectionFor<MbEventSeqFluentOrderSummary> {
    define(builder: IProjectionBuilderFor<MbEventSeqFluentOrderSummary>): void {
        builder.from(MbEventSeqFluentOrderPlaced, _ => _
            .set(m => m.totalAmount).to(e => e.amount));
    }
}

class MbEventSeqFluentOrderSummary {
    totalAmount = 0;
}
```
