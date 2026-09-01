```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecRemoveWithJoinBasicUserCreated {
    constructor(readonly name: string) {}
}

@eventType()
class DecRemoveWithJoinBasicUserAddedToGroup {
    constructor(readonly userId: string, readonly groupId: string) {}
}

@eventType()
class DecRemoveWithJoinBasicGroupCreated {
    constructor(readonly name: string) {}
}

@eventType()
class DecRemoveWithJoinBasicGroupDeleted {
}

class DecRemoveWithJoinBasicUserGroup {
    groupId = '';
    name = '';
    joinedAt = new Date();
}

class DecRemoveWithJoinBasicUser {
    name = '';
    groups: DecRemoveWithJoinBasicUserGroup[] = [];
}

@projection()
class DecRemoveWithJoinBasicUserProjection implements IProjectionFor<DecRemoveWithJoinBasicUser> {
    define(builder: IProjectionBuilderFor<DecRemoveWithJoinBasicUser>): void {
        builder
            .autoMap()
            .from(DecRemoveWithJoinBasicUserCreated)
            .children<DecRemoveWithJoinBasicUserGroup>(m => m.groups, children => children
                .identifiedBy(e => e.groupId)
                .autoMap()
                .from(DecRemoveWithJoinBasicUserAddedToGroup, _ => _
                    .usingParentKey(e => e.userId)
                    .set(m => m.joinedAt).toEventContextProperty('occurred'))
                .join(DecRemoveWithJoinBasicGroupCreated, _ => _
                    .on(m => m.groupId))
                .removedWithJoin(DecRemoveWithJoinBasicGroupDeleted));
    }
}
```
