```typescript
import { fromEvent, Guid, readModel } from '@cratis/chronicle';

@readModel()
@fromEvent(MbIndexAutoMapAccountOpened)
class MbIndexAutoMapMbAccountInfo {
    id: Guid = Guid.empty;
    name = '';        // Automatically mapped from MbIndexAutoMapAccountOpened.name
    balance = 0;       // Automatically mapped from MbIndexAutoMapAccountOpened.balance
}
```
