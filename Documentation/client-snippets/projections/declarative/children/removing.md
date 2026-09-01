```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class GroupCreatedWithRemoval {
    constructor(readonly name: string) {}
}

@eventType()
class UserAddedWithRemoval {
    constructor(readonly userId: string, readonly role: string) {}
}

@eventType()
class UserRemovedWithRemoval {
    constructor(readonly userId: string) {}
}

class GroupMemberWithRemoval {
    userId = '';
    role = '';
}

class GroupWithRemoval {
    name = '';
    members: GroupMemberWithRemoval[] = [];
}

@projection()
class GroupWithRemovalProjection implements IProjectionFor<GroupWithRemoval> {
    define(builder: IProjectionBuilderFor<GroupWithRemoval>): void {
        builder
            .from(GroupCreatedWithRemoval)
            .children<GroupMemberWithRemoval>(m => m.members, children => children
                .identifiedBy(m => m.userId)
                .from(UserAddedWithRemoval, b => b
                    .usingKey(e => e.userId))
                .removedWith(UserRemovedWithRemoval, b => b
                    .usingKey(e => e.userId)));
    }
}
```
