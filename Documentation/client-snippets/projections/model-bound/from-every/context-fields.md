```typescript title="Track audit metadata from every event"
import { eventType, fromEvent, fromEvery } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
export class AuditableInventoryChangedForEvery {
    @field(String) readonly reason: string;

    constructor(reason: string) {
        this.reason = reason;
    }
}

@fromEvent(AuditableInventoryChangedForEvery)
export class AuditableInventoryStatusFromEvery {
    @fromEvery(undefined, 'occurred')
    lastModified = new Date();

    @fromEvery(undefined, 'sequenceNumber')
    @field(Number) lastEventSequence = 0n;

    @fromEvery(undefined, 'correlationId')
    lastCorrelationId = '';
}
```
