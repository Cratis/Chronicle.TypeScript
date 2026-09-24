```typescript
import { eventType, fromEvent, Guid, setFrom, setValue } from '@cratis/chronicle';

@eventType()
export class MbSetValueInvoiceIssued {
    amount = 0;
}

@eventType()
export class MbSetValueInvoicePaid {
}

@fromEvent(MbSetValueInvoiceIssued)
@fromEvent(MbSetValueInvoicePaid)
export class MbSetValueInvoice {
    id: Guid = Guid.empty;

    @setFrom(MbSetValueInvoiceIssued, 'amount')
    amount = 0;

    @setValue(MbSetValueInvoiceIssued, 'issued')
    @setValue(MbSetValueInvoicePaid, 'paid')
    status = '';
}
```
