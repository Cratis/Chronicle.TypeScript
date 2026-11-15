```typescript
import { EventContext, eventStreamType, eventType, IEventStore, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class FilterByStreamTypePaymentReceived {
    @field(Number) readonly amount: number;

    constructor(amount: number) {
        this.amount = amount;
    }
}

class FilterByStreamTypePaymentService {
    constructor(private readonly store: IEventStore) {}

    async receive(eventSourceId: string, amount: number): Promise<void> {
        await this.store.eventLog.append(
            eventSourceId,
            new FilterByStreamTypePaymentReceived(amount),
            { streamType: 'payments' });
    }
}

@reactor()
@eventStreamType('payments')
class FilterByStreamTypeReceiptReactor {
    async filterByStreamTypePaymentReceived(_event: FilterByStreamTypePaymentReceived, _context: EventContext): Promise<void> {}
}
```
