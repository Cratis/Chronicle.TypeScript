```typescript
import { eventType, Guid, increment, readModel } from '@cratis/chronicle';

@eventType()
class MbCountersUserLoggedIn {
}

@readModel()
class MbCountersUserStatistics {
    id: Guid = Guid.empty;

    @increment(MbCountersUserLoggedIn)
    loginCount = 0;
}
```
