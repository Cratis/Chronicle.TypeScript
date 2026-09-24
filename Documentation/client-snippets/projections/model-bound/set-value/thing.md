```typescript
import { eventType, fromEvent, Guid, setValue } from '@cratis/chronicle';

@eventType()
export class MbSetValueThingHappened {
}

@fromEvent(MbSetValueThingHappened)
export class MbSetValueThing {
    id: Guid = Guid.empty;

    @setValue(MbSetValueThingHappened, 'pending')
    statusLabel = '';

    @setValue(MbSetValueThingHappened, 42)
    priority = 0;

    @setValue(MbSetValueThingHappened, true)
    isActive = false;

    @setValue(MbSetValueThingHappened, 3.14)
    score = 0;
}
```
