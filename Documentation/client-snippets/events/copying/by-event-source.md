```typescript
import { Guid, IEventLog } from '@cratis/chronicle';

class CopyByEventSourceService {
    constructor(private readonly eventLog: IEventLog) {}

    copyAccount(sourceId: string, targetId: string): Promise<Guid> {
        return this.eventLog.copy(sourceId, targetId);
    }
}
```
