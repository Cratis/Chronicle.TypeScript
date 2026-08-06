```typescript
import { EventSequenceNumber, IEventLog } from '@cratis/chronicle';

class RedactionUnknownReasonService {
    constructor(private readonly eventLog: IEventLog) {}

    // The TypeScript client always requires an explicit reason - there is no
    // "unknown reason" default overload.
    redact(sequenceNumber: EventSequenceNumber): Promise<void> {
        return this.eventLog.redact(sequenceNumber, 'Unknown');
    }
}
```
