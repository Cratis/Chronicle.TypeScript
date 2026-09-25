```typescript
import { count, fromEvent, Guid } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@fromEvent(CrudComparisonCustomerRegistered)
@fromEvent(CrudComparisonAddressChanged)
export class CrudComparisonCustomerCard {
    id: Guid = Guid.empty;
    @field(String) name = '';
    @field(String) address = '';

    @count(CrudComparisonAddressChanged)
    timesRelocated = 0;
}
```
