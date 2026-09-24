```typescript
import { count, fromEvent, Guid } from '@cratis/chronicle';

@fromEvent(CrudComparisonCustomerRegistered)
@fromEvent(CrudComparisonAddressChanged)
export class CrudComparisonCustomerCard {
    id: Guid = Guid.empty;
    name = '';
    address = '';

    @count(CrudComparisonAddressChanged)
    timesRelocated = 0;
}
```
