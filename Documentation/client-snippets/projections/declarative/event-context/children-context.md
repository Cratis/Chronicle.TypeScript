```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecEventContextActivityPerformed {
    constructor(readonly activityId: string, readonly activityType: string) {}
}

class DecEventContextActivityLogEntry {
    activityId = '';
    timestamp = new Date();
    sequenceNumber = 0n;
}

class DecEventContextUserWithActivityLog {
    activityLog: DecEventContextActivityLogEntry[] = [];
}

@projection()
class DecEventContextUserActivityLogProjection implements IProjectionFor<DecEventContextUserWithActivityLog> {
    define(builder: IProjectionBuilderFor<DecEventContextUserWithActivityLog>): void {
        builder
            .children<DecEventContextActivityLogEntry>(m => m.activityLog, children => children
                .identifiedBy(e => e.activityId)
                .autoMap()
                .from(DecEventContextActivityPerformed, _ => _
                    .usingKey(e => e.activityId)
                    .set(m => m.timestamp).toEventContextProperty('occurred')
                    .set(m => m.sequenceNumber).toEventContextProperty('sequenceNumber')));
    }
}
```
