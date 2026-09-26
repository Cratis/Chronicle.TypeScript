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

@eventType()
class DecEventContextOrderLineAdded {
    @field(String) readonly lineId: string;

    constructor(lineId: string) {
        this.lineId = lineId;
    }
}

class DecEventContextOrderLine {
    lineId = '';
}

class DecEventContextOrder {
    lines: DecEventContextOrderLine[] = [];
}

// addChild can take the child key and the parent key from the event context:
// each line is identified by the sequence number of the event that added it.
@projection()
class DecEventContextOrderProjection implements IProjectionFor<DecEventContextOrder> {
    define(builder: IProjectionBuilderFor<DecEventContextOrder>): void {
        builder.from(DecEventContextOrderLineAdded, from => from
            .addChild(model => model.lines, child => child
                .identifiedBy(line => line.lineId)
                .usingKeyFromContext('sequenceNumber')
                .usingParentKeyFromContext('eventSourceId')));
    }
}
```
