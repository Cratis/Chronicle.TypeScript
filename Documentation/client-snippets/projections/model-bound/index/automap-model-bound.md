```typescript
import { fromEvent, Guid } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@fromEvent(MbIndexAutoMapAccountOpened)
export class MbIndexAutoMapMbAccountInfo {
    id: Guid = Guid.empty;
    @field(String) name = '';        // Automatically mapped from MbIndexAutoMapAccountOpened.name
    @field(Number) balance = 0;       // Automatically mapped from MbIndexAutoMapAccountOpened.balance
}
```
