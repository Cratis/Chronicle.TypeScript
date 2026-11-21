```typescript
import { eventType, handles, ICanBeNotifiedWhenReplay, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ReplayNotifiedItemAdded {
    @field(String) readonly orderId: string;

    constructor(orderId: string) {
        this.orderId = orderId;
    }
}

class ReplayNotifiedOrderTotals {
    items = 0;
}

@reducer('replay-notified-order-totals', undefined, ReplayNotifiedOrderTotals)
class ReplayNotifiedOrderTotalsReducer implements ICanBeNotifiedWhenReplay {
    async beginReplay(): Promise<void> {
    }

    async endReplay(): Promise<void> {
    }

    @handles(ReplayNotifiedItemAdded)
    itemAdded(event: ReplayNotifiedItemAdded, current: ReplayNotifiedOrderTotals | undefined): ReplayNotifiedOrderTotals {
        return { items: (current?.items ?? 0) + 1 };
    }
}
```
