```typescript
import { eventType, Guid, notRewindable, setFrom } from '@cratis/chronicle';

@eventType()
export class MbNotRewindableAuditEvent {
    message = '';
    occurredAt = new Date();
}

@notRewindable
export class MbNotRewindableAuditLog {
    id: Guid = Guid.empty;

    @setFrom(MbNotRewindableAuditEvent, 'message')
    message = '';

    @setFrom(MbNotRewindableAuditEvent, 'occurredAt')
    timestamp = new Date();
}
```
