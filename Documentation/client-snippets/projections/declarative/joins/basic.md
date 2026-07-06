```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecJoinsUserCreated {
    name = '';
    email = '';
}

@eventType()
class DecJoinsUserAssignedToGroup {
    userId = '';
    groupId = '';
}

@eventType()
class DecJoinsGroupCreated {
    name = '';
    description = '';
}

@eventType()
class DecJoinsGroupRenamed {
    newName = '';
}

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
