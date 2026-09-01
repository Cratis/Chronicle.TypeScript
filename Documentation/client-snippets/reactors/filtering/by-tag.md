```typescript
import { EventContext, eventType, filterEventsByTag, IEventStore, reactor } from '@cratis/chronicle';

@eventType()
class ReactorsFilteringByTagOrderPlaced {
    constructor(readonly totalAmount: number) {}
}

class ReactorsFilteringByTagOrderService {
    constructor(private readonly store: IEventStore) {}

    async placePriorityOrder(eventSourceId: string, totalAmount: number): Promise<void> {
        await this.store.eventLog.append(
            eventSourceId,
            new ReactorsFilteringByTagOrderPlaced(totalAmount),
            { tags: ['priority'] });
    }
}

@reactor()
@filterEventsByTag('priority')
class ReactorsFilteringPriorityOrderNotifier {
    async reactorsFilteringByTagOrderPlaced(_event: ReactorsFilteringByTagOrderPlaced, _context: EventContext): Promise<void> {}
}
```
