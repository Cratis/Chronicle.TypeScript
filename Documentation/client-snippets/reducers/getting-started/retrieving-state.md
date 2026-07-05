```typescript
import { IEventStore } from '@cratis/chronicle';

class ReducersGettingStartedOrderService {
    constructor(private readonly store: IEventStore) {}

    async getOrderSummary(orderId: string): Promise<ReducersGettingStartedOrderSummary> {
        return this.store.readModels.getInstanceById(ReducersGettingStartedOrderSummary, orderId);
    }
}
```
