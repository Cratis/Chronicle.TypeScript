```typescript
import { eventSequence, eventType, fromEvent, setFrom } from '@cratis/chronicle';

@eventType()
export class MbEventSeqOrderPlaced {
    amount = 0;
}

@fromEvent(MbEventSeqOrderPlaced)
@eventSequence('custom-sequence')
export class MbEventSeqOrderSummary {
    @setFrom(MbEventSeqOrderPlaced, 'amount')
    totalAmount = 0;
}
```
