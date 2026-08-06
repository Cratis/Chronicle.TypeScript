```typescript
import { IEventLog } from '@cratis/chronicle';

async function closeInvoiceStream(eventLog: IEventLog, invoiceStreamId: string): Promise<void> {
    const result = await eventLog.completeStream('invoices', invoiceStreamId);

    if (result.isSuccess) {
        console.log(`Stream closed at sequence number ${result.sequenceNumber.value}`);
    } else {
        console.log(`Failed to close stream: ${result.error}`);
    }
}
```
