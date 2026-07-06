```typescript
import { eventType, fromEvent, Guid, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class MbIndexAccountOpened {
    name = '';
    initialBalance = 0;
}

@readModel()
@fromEvent(MbIndexAccountOpened)
class MbIndexAccountInfo {
    id: Guid = Guid.empty;
    name = '';

    @setFrom(MbIndexAccountOpened, 'initialBalance')
    balance = 0;
}
```
