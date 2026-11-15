```typescript
import { eventStreamType, eventType, IEventStore, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class FilterByStreamTypePaymentSettled {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

class FilterByStreamTypeSettledTotals {
    totalAmount = 0;
}

@reducer('', undefined, FilterByStreamTypeSettledTotals)
@eventStreamType('payments')
class FilterByStreamTypeSettledTotalsReducer {
    filterByStreamTypePaymentSettled(
        event: FilterByStreamTypePaymentSettled,
        current: FilterByStreamTypeSettledTotals | undefined
    ): FilterByStreamTypeSettledTotals {
        return { totalAmount: (current?.totalAmount ?? 0) + event.amount };
    }
}

class FilterByStreamTypeSettlementService {
    constructor(private readonly store: IEventStore) {}

    async settle(eventSourceId: string, amount: number): Promise<void> {
        await this.store.eventLog.append(
            eventSourceId,
            new FilterByStreamTypePaymentSettled(amount),
            { streamType: 'payments' });
    }
}
```
