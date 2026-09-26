```typescript
import { eventType, IEventLog } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ClosingStreamsInvoiceLineAdded {
    @field(String) readonly description: string;
    @field(Number) readonly amount: number;

    constructor(description: string = '', amount: number = 0) {
        this.description = description;
        this.amount = amount;
    }
}

async function tryAppendLine(eventLog: IEventLog, invoiceId: string): Promise<boolean> {
    const [appendResult] = await eventLog.appendMany([{
        eventSourceId: invoiceId,
        event: new ClosingStreamsInvoiceLineAdded('Consulting', 500),
        eventStreamType: 'invoices',
        eventStreamId: 'invoice-42'
    }]);

    if (!appendResult.isSuccess) {
        const wasStreamClosed = appendResult.constraintViolations.some(violation => violation.constraintId === 'StreamClosed');
        return !wasStreamClosed;
    }

    return true;
}
```
