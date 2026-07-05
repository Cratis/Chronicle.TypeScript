```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecEventContextUserAction {
    userId = '';
    actionType = '';
}

@projection()
class DecEventContextAuditTrailProjection implements IProjectionFor<DecEventContextAuditEntry> {
    define(builder: IProjectionBuilderFor<DecEventContextAuditEntry>): void {
        builder
            .autoMap()
            .from(DecEventContextUserAction, _ => _
                .set(m => m.eventId).toEventContextProperty('sequenceNumber')
                .set(m => m.occurredAt).toEventContextProperty('occurred')
                .set(m => m.correlationId).toEventContextProperty('correlationId'));
    }
}
```
