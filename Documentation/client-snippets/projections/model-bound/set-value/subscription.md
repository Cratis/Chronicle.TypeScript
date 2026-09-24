```typescript
import { eventType, fromEvent, Guid, setValue } from '@cratis/chronicle';

@eventType()
export class MbSetValueSubscriptionStarted {
}

@eventType()
export class MbSetValueSubscriptionPaused {
}

@eventType()
export class MbSetValueSubscriptionCanceled {
}

@fromEvent(MbSetValueSubscriptionStarted)
@fromEvent(MbSetValueSubscriptionPaused)
@fromEvent(MbSetValueSubscriptionCanceled)
export class MbSetValueSubscription {
    id: Guid = Guid.empty;

    @setValue(MbSetValueSubscriptionStarted, 'active')
    @setValue(MbSetValueSubscriptionPaused, 'paused')
    @setValue(MbSetValueSubscriptionCanceled, 'canceled')
    state = '';
}
```
