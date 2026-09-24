```typescript title="Track audit metadata from every event"
import { eventType, fromEvent, fromEvery } from '@cratis/chronicle';

@eventType()
export class AuditableInventoryChangedForEvery {
    constructor(readonly reason: string) {}
}

@fromEvent(AuditableInventoryChangedForEvery)
export class AuditableInventoryStatusFromEvery {
    @fromEvery(undefined, 'occurred')
    lastModified = new Date();

    @fromEvery(undefined, 'sequenceNumber')
    lastEventSequence = 0n;

    @fromEvery(undefined, 'correlationId')
    lastCorrelationId = '';
}
```
