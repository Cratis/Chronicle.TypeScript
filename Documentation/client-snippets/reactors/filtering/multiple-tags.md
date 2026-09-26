```typescript
import { EventContext, eventType, filterEventsByTag, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ReactorsFilteringMultiTagOrderPlaced {
    @field(Number) readonly totalAmount: number;

    constructor(totalAmount: number) {
        this.totalAmount = totalAmount;
    }
}

@reactor()
@filterEventsByTag('priority')
@filterEventsByTag('express')
class ReactorsFilteringFastTrackOrderNotifier {
    async reactorsFilteringMultiTagOrderPlaced(_event: ReactorsFilteringMultiTagOrderPlaced, _context: EventContext): Promise<void> {}
}
```
