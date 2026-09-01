```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class GroupCreatedWithEventParentKey {
    constructor(readonly name: string) {}
}

@eventType()
class UserAddedWithEventParentKey {
    constructor(readonly groupId: string, readonly userId: string, readonly role: string) {}
}

class GroupMemberWithEventParentKey {
    userId = '';
    role = '';
}

class GroupWithEventParentKey {
    name = '';
    members: GroupMemberWithEventParentKey[] = [];
}

@projection()
class GroupWithEventParentKeyProjection implements IProjectionFor<GroupWithEventParentKey> {
    define(builder: IProjectionBuilderFor<GroupWithEventParentKey>): void {
        builder
            .from(GroupCreatedWithEventParentKey)
            .children<GroupMemberWithEventParentKey>(m => m.members, children => children
                .identifiedBy(m => m.userId)
                .from(UserAddedWithEventParentKey, b => b
                    .usingParentKey(e => e.groupId)
                    .usingKey(e => e.userId)));
    }
}
```
