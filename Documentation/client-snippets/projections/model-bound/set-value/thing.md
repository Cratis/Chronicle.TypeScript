```typescript
import { eventType, fromEvent, Guid, readModel, setValue } from '@cratis/chronicle';

@eventType()
class MbSetValueThingHappened {
}

@readModel()
@fromEvent(MbSetValueThingHappened)
class MbSetValueThing {
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
