```typescript
import { count, fromEvent, Guid, readModel } from '@cratis/chronicle';

@readModel()
@fromEvent(CrudComparisonCustomerRegistered)
@fromEvent(CrudComparisonAddressChanged)
class CrudComparisonCustomerCard {
    id: Guid = Guid.empty;
    name = '';
    address = '';

    @count(CrudComparisonAddressChanged)
    timesRelocated = 0;
}
```
