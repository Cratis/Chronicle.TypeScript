```typescript
import { eventType, Guid, increment } from '@cratis/chronicle';

@eventType()
export class MbCountersUserLoggedIn {
}

export class MbCountersUserStatistics {
    id: Guid = Guid.empty;

    @increment(MbCountersUserLoggedIn)
    loginCount = 0;
}
```
