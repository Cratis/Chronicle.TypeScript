```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
export class MbCountersUserConnected {
}

@eventType()
export class MbCountersUserDisconnected {
}

export class MbCountersServerStatistics {
    id: Guid = Guid.empty;

    @increment(MbCountersUserConnected)
    @decrement(MbCountersUserDisconnected)
    activeConnections = 0;
}
```
