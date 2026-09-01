```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class GroupCreatedWithContextParentKey {
    constructor(readonly name: string) {}
}

@eventType()
class UserAddedWithContextParentKey {
    constructor(readonly userId: string, readonly role: string) {}
}

class GroupMemberWithContextParentKey {
    userId = '';
    role = '';
}

class GroupWithContextParentKey {
    name = '';
    members: GroupMemberWithContextParentKey[] = [];
}

@projection()
class GroupWithContextParentKeyProjection implements IProjectionFor<GroupWithContextParentKey> {
    define(builder: IProjectionBuilderFor<GroupWithContextParentKey>): void {
        builder
            .from(GroupCreatedWithContextParentKey)
            .children<GroupMemberWithContextParentKey>(m => m.members, children => children
                .identifiedBy(m => m.userId)
                .from(UserAddedWithContextParentKey, b => b
                    .usingParentKeyFromContext('eventSourceId')
                    .usingKey(e => e.userId)));
    }
}
```
