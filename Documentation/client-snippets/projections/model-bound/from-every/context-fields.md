```typescript title="Track audit metadata from every event"
import { eventType, fromEvent, fromEvery, readModel } from '@cratis/chronicle';

@eventType()
class AuditableInventoryChangedForEvery {
    constructor(readonly reason: string) {}
}

@readModel()
@fromEvent(AuditableInventoryChangedForEvery)
class AuditableInventoryStatusFromEvery {
    @fromEvery(undefined, 'occurred')
    lastModified = new Date();

    @fromEvery(undefined, 'sequenceNumber')
    lastEventSequence = 0n;

    @fromEvery(undefined, 'correlationId')
    lastCorrelationId = '';
}
```
