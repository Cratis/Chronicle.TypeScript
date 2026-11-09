```typescript
import { eventType, IEventLog, ImportResult } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class LegacyInvoiceIssued {
    @field(String) readonly invoiceNumber: string;

    constructor(invoiceNumber: string = '') {
        this.invoiceNumber = invoiceNumber;
    }
}

class InvoiceMigration {
    constructor(private readonly eventLog: IEventLog) {}

    async resume(importId: string, source: readonly { invoiceId: string; invoiceNumber: string }[]): Promise<ImportResult> {
        const session = await this.eventLog.beginImport(importId);

        // The kernel already holds the first eventsAcknowledged events; continue with the rest.
        const remaining = source
            .slice(session.eventsAcknowledged)
            .map(invoice => ({ eventSourceId: invoice.invoiceId, event: new LegacyInvoiceIssued(invoice.invoiceNumber) }));
        await session.add(remaining);
        return session.complete();
    }
}
```
