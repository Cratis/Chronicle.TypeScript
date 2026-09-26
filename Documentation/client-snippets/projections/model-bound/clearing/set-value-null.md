```typescript
import { eventType, fromEvent, Guid, setValue } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class MbClearingInvoiceIssued {
    @field(String) readonly reference: string;

    constructor(reference: string) {
        this.reference = reference;
    }
}

@eventType()
export class MbClearingInvoiceVoided {
}

@fromEvent(MbClearingInvoiceIssued)
export class MbClearingInvoice {
    id: Guid = Guid.empty;

    @setValue(MbClearingInvoiceVoided, null)
    @field(String) reference: string | null = null;
}
```
