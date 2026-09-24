```typescript
import { eventType, Guid, passive, setFrom } from '@cratis/chronicle';

@eventType()
export class MbPassiveSnapshotCreated {
    data = '';
}

@passive
export class MbPassiveHistoricalSnapshot {
    id: Guid = Guid.empty;

    @setFrom(MbPassiveSnapshotCreated, 'data')
    data = '';
}
```
