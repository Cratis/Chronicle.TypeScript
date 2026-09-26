```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class DecEventContextActivityPerformed {
    @field(String) readonly activityId: string;
    @field(String) readonly activityType: string;

    constructor(activityId: string, activityType: string) {
        this.activityId = activityId;
        this.activityType = activityType;
    }
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
