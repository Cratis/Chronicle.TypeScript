```typescript
import { EventContext, eventType, filterEventsByTag, reactor } from '@cratis/chronicle';

@eventType()
class ReactorsFilteringMultiTagOrderPlaced {
    constructor(readonly totalAmount: number) {}
}

@reactor()
@filterEventsByTag('priority')
@filterEventsByTag('express')
class ReactorsFilteringFastTrackOrderNotifier {
    async reactorsFilteringMultiTagOrderPlaced(_event: ReactorsFilteringMultiTagOrderPlaced, _context: EventContext): Promise<void> {}
}
```
