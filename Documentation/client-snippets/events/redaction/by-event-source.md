```typescript
import { IEventLog } from '@cratis/chronicle';

class RedactionByEventSourceService {
    constructor(private readonly eventLog: IEventLog) {}

    redactAccount(eventSourceId: string): Promise<void> {
        return this.eventLog.redactForEventSource(eventSourceId, 'Account deletion requested');
    }
}
```
