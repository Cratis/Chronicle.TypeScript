```typescript
import { eventType, fromEvent, Guid, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class MbIndexAccountOpened {
    name = '';
    initialBalance = 0;
}

@fromEvent(MbIndexAccountOpened)
export class MbIndexAccountInfo {
    id: Guid = Guid.empty;
    @field(String) name = '';

    @setFrom(MbIndexAccountOpened, 'initialBalance')
    balance = 0;
}
```
