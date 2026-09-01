```typescript
import { eventSequence, eventType, fromEvent, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class MbEventSeqOrderPlaced {
    amount = 0;
}

@readModel()
@fromEvent(MbEventSeqOrderPlaced)
@eventSequence('custom-sequence')
class MbEventSeqOrderSummary {
    @setFrom(MbEventSeqOrderPlaced, 'amount')
    totalAmount = 0;
}
```
