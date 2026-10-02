```typescript
import { field } from '@cratis/fundamentals';
import { eventType, eventSourceType, Guid, IEventLog, reducer } from '@cratis/chronicle';

@eventType()
class ReducersFilteringInvoiceIssued {
    @field(Number) amount = 0;
}

class ReducersFilteringCustomerInvoiceTotal { amount = 0; }

class ReducersFilteringInvoicingService {
    constructor(private readonly eventLog: IEventLog) {}

    async issueCustomerInvoice(amount: number): Promise<void> {
        const result = await this.eventLog.append(Guid.create().toString(),
            Object.assign(new ReducersFilteringInvoiceIssued(), { amount }), { sourceType: 'customer' });
        if (!result.isSuccess) throw new Error('Invoice issue failed');
    }
}

@reducer('', undefined, ReducersFilteringCustomerInvoiceTotal)
@eventSourceType('customer')
class ReducersFilteringCustomerInvoiceTotalReducer {
    reducersFilteringInvoiceIssued(event: ReducersFilteringInvoiceIssued,
        current: ReducersFilteringCustomerInvoiceTotal | undefined): ReducersFilteringCustomerInvoiceTotal {
        return { amount: (current?.amount ?? 0) + event.amount };
    }
}
```
