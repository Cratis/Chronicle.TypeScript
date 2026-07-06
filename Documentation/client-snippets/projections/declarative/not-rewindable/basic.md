```typescript
import { IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@projection()
class DecNotRewindableAuditLogProjection implements IProjectionFor<DecNotRewindableAuditLogEntry> {
    define(builder: IProjectionBuilderFor<DecNotRewindableAuditLogEntry>): void {
        builder
            .notRewindable()
            .autoMap()
            .fromEvery(_ => _
                .set(m => m.processedAt).toEventContextProperty('occurred'))
            .from(DecNotRewindableUserAction, _ => _
                .set(m => m.occurredAt).toEventContextProperty('occurred'));
    }
}
```
