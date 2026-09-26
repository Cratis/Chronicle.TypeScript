```typescript
import { EventContext, eventType, filterEventsByTag, IEventStore, reactor, fromEvent } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class FilteringWithReactorOrderPlaced {
    @field(String) readonly customerId: string;
    @field(Number) readonly totalAmount: number;

    constructor(customerId: string, totalAmount: number) {
        this.customerId = customerId;
        this.totalAmount = totalAmount;
    }
}

class FilteringWithReactorOrderService {
    constructor(private readonly store: IEventStore) {}

    async placePremiumOrder(orderId: string, customerId: string, totalAmount: number): Promise<void> {
        await this.store.eventLog.append(orderId,
            new FilteringWithReactorOrderPlaced(customerId, totalAmount), { tags: ['premium'] });
    }
}

@fromEvent(FilteringWithReactorOrderPlaced, { key: 'customerId' })
class FilteringWithReactorOrderSummary {
    customerId = '';
    totalAmount = 0;
}

@reactor()
@filterEventsByTag('premium')
class FilteringWithReactorPremiumOrderNotifier {
    async filteringWithReactorOrderPlaced(_event: FilteringWithReactorOrderPlaced, _context: EventContext): Promise<void> {}
}
```
