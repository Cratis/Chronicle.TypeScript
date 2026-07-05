```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class MbCountersUserConnected {
}

@eventType()
class MbCountersUserDisconnected {
}

@readModel()
class MbCountersServerStatistics {
    id: Guid = Guid.empty;

    @increment(MbCountersUserConnected)
    @decrement(MbCountersUserDisconnected)
    activeConnections = 0;
}
```
