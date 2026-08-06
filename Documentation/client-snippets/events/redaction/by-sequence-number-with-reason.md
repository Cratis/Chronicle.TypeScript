```typescript
import { EventSequenceNumber, IEventLog } from '@cratis/chronicle';

class RedactionWithReasonService {
    constructor(private readonly eventLog: IEventLog) {}

    redact(sequenceNumber: EventSequenceNumber): Promise<void> {
        return this.eventLog.redact(sequenceNumber, 'GDPR erasure request');
    }
}
```
