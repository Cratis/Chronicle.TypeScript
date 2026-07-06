```typescript
import { eventType, Guid, notRewindable, readModel, setFrom } from '@cratis/chronicle';

@eventType()
class MbNotRewindableAuditEvent {
    message = '';
    occurredAt = new Date();
}

@readModel()
@notRewindable
class MbNotRewindableAuditLog {
    id: Guid = Guid.empty;

    @setFrom(MbNotRewindableAuditEvent, 'message')
    message = '';

    @setFrom(MbNotRewindableAuditEvent, 'occurredAt')
    timestamp = new Date();
}
```
