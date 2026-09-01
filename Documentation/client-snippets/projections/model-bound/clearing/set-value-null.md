```typescript
import { eventType, fromEvent, Guid, readModel, setValue } from '@cratis/chronicle';

@eventType()
class MbClearingInvoiceIssued {
    constructor(readonly reference: string) {}
}

@eventType()
class MbClearingInvoiceVoided {
}

@readModel()
@fromEvent(MbClearingInvoiceIssued)
class MbClearingInvoice {
    id: Guid = Guid.empty;

    @setValue(MbClearingInvoiceVoided, null)
    reference: string | null = null;
}
```
