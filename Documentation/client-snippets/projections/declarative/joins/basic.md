```typescript
import { IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@projection()
class DecJoinsUserProjection implements IProjectionFor<DecJoinsUser> {
    define(builder: IProjectionBuilderFor<DecJoinsUser>): void {
        builder
            .autoMap()
            .from(DecJoinsUserCreated)
            .from(DecJoinsUserAssignedToGroup, b => b
                .usingKey(e => e.userId)
                .set(m => m.groupId).toEventSourceId())
            .join(DecJoinsGroupCreated, j => j
                .on(m => m.groupId))
            .join(DecJoinsGroupRenamed, j => j
                .on(m => m.groupId));
    }
}
```
