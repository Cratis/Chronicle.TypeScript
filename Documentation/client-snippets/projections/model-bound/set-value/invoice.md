```typescript
import { eventType, fromEvent, Guid, readModel, setFrom, setValue } from '@cratis/chronicle';

@eventType()
class MbSetValueInvoiceIssued {
    amount = 0;
}

@eventType()
class MbSetValueInvoicePaid {
}

@readModel()
@fromEvent(MbSetValueInvoiceIssued)
@fromEvent(MbSetValueInvoicePaid)
class MbSetValueInvoice {
    id: Guid = Guid.empty;

    @setFrom(MbSetValueInvoiceIssued, 'amount')
    amount = 0;

    @setValue(MbSetValueInvoiceIssued, 'issued')
    @setValue(MbSetValueInvoicePaid, 'paid')
    status = '';
}
```
