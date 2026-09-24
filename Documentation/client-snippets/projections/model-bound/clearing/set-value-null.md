```typescript
import { eventType, fromEvent, Guid, setValue } from '@cratis/chronicle';

@eventType()
export class MbClearingInvoiceIssued {
    constructor(readonly reference: string) {}
}

@eventType()
export class MbClearingInvoiceVoided {
}

@fromEvent(MbClearingInvoiceIssued)
export class MbClearingInvoice {
    id: Guid = Guid.empty;

    @setValue(MbClearingInvoiceVoided, null)
    reference: string | null = null;
}
```
