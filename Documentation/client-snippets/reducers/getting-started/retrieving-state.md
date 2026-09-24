```typescript
import { IEventStore } from '@cratis/chronicle';

class ReducersGettingStartedOrderService {
    constructor(private readonly store: IEventStore) {}

    async getOrderSummary(orderId: string): Promise<ReducersGettingStartedOrderSummary | null> {
        return this.store.readModels.findInstanceById(ReducersGettingStartedOrderSummary, orderId);
    }
}
```
