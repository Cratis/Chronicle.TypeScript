```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecNotRewindableUserLoginAttempt {
    userId = '';
    succeeded = false;
}

@eventType()
class DecNotRewindablePermissionChange {
    userId = '';
    permission = '';
}

class DecNotRewindableSecurityAuditEntry {
    auditedAt = new Date();
    sequenceNumber: bigint = 0n;
}

@projection()
class DecNotRewindableSecurityAuditProjection implements IProjectionFor<DecNotRewindableSecurityAuditEntry> {
    define(builder: IProjectionBuilderFor<DecNotRewindableSecurityAuditEntry>): void {
        builder
            .notRewindable()
            .autoMap()
            .fromEvery(_ => _
                .set(m => m.auditedAt).toEventContextProperty('occurred')
                .set(m => m.sequenceNumber).toEventContextProperty('sequenceNumber'))
            .from(DecNotRewindableUserLoginAttempt)
            .from(DecNotRewindablePermissionChange);
    }
}
```
