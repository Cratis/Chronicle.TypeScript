```typescript
import { fromEvent, Guid } from '@cratis/chronicle';

@fromEvent(MbIndexAutoMapAccountOpened)
export class MbIndexAutoMapMbAccountInfo {
    id: Guid = Guid.empty;
    name = '';        // Automatically mapped from MbIndexAutoMapAccountOpened.name
    balance = 0;       // Automatically mapped from MbIndexAutoMapAccountOpened.balance
}
```
