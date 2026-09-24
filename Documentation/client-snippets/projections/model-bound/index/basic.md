```typescript
import { eventType, fromEvent, Guid, setFrom } from '@cratis/chronicle';

@eventType()
export class MbIndexAccountOpened {
    name = '';
    initialBalance = 0;
}

@fromEvent(MbIndexAccountOpened)
export class MbIndexAccountInfo {
    id: Guid = Guid.empty;
    name = '';

    @setFrom(MbIndexAccountOpened, 'initialBalance')
    balance = 0;
}
```
