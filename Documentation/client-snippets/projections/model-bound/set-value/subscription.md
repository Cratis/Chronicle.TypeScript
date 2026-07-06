```typescript
import { eventType, fromEvent, Guid, readModel, setValue } from '@cratis/chronicle';

@eventType()
class MbSetValueSubscriptionStarted {
}

@eventType()
class MbSetValueSubscriptionPaused {
}

@eventType()
class MbSetValueSubscriptionCanceled {
}

@readModel()
@fromEvent(MbSetValueSubscriptionStarted)
@fromEvent(MbSetValueSubscriptionPaused)
@fromEvent(MbSetValueSubscriptionCanceled)
class MbSetValueSubscription {
    id: Guid = Guid.empty;

    @setValue(MbSetValueSubscriptionStarted, 'active')
    @setValue(MbSetValueSubscriptionPaused, 'paused')
    @setValue(MbSetValueSubscriptionCanceled, 'canceled')
    state = '';
}
```
