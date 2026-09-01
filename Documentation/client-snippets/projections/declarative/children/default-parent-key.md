```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class GroupCreatedWithDefaultParentKey {
    constructor(readonly name: string) {}
}

@eventType()
class UserAddedWithDefaultParentKey {
    constructor(readonly userId: string, readonly role: string) {}
}

class GroupMemberWithDefaultParentKey {
    userId = '';
    role = '';
}

class GroupWithDefaultParentKey {
    name = '';
    members: GroupMemberWithDefaultParentKey[] = [];
}

@projection()
class GroupWithDefaultParentKeyProjection implements IProjectionFor<GroupWithDefaultParentKey> {
    define(builder: IProjectionBuilderFor<GroupWithDefaultParentKey>): void {
        builder
            .from(GroupCreatedWithDefaultParentKey)
            .children<GroupMemberWithDefaultParentKey>(m => m.members, children => children
                .identifiedBy(m => m.userId)
                .from(UserAddedWithDefaultParentKey, b => b
                    .usingKey(e => e.userId)));
    }
}
```
