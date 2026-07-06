```typescript
import { eventType, Guid, passive, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class MbPassiveSnapshotCreated {
    data = '';
}

@readModel()
@passive
class MbPassiveHistoricalSnapshot {
    id: Guid = Guid.empty;

    @setFrom(MbPassiveSnapshotCreated, 'data')
    data = '';
}
```
