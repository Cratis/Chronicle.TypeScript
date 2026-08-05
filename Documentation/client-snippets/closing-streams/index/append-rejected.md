```typescript
import { eventType, IEventLog } from '@cratis/chronicle';

@eventType()
class ClosingStreamsInvoiceLineAdded {
    constructor(readonly description: string = '', readonly amount: number = 0) {}
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
