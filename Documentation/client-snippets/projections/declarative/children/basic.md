```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class GroupCreatedForChildren {
    constructor(readonly name: string, readonly description: string) {}
}

@eventType()
class UserAddedToGroupForChildren {
    constructor(readonly userId: string, readonly role: string) {}
}

@eventType()
class UserRoleChangedForChildren {
    constructor(readonly userId: string, readonly role: string) {}
}

@eventType()
class UserRemovedFromGroupForChildren {
    constructor(readonly userId: string) {}
}

class GroupMemberForChildren {
    userId = '';
    role = '';
}

class GroupForChildren {
    name = '';
    description = '';
    members: GroupMemberForChildren[] = [];
}

@projection()
class GroupProjectionForChildren implements IProjectionFor<GroupForChildren> {
    define(builder: IProjectionBuilderFor<GroupForChildren>): void {
        builder
            .from(GroupCreatedForChildren)
            .children<GroupMemberForChildren>(m => m.members, children => children
                .identifiedBy(m => m.userId)
                .from(UserAddedToGroupForChildren, b => b
                    .usingKey(e => e.userId))
                .from(UserRoleChangedForChildren, b => b
                    .usingKey(e => e.userId))
                .removedWith(UserRemovedFromGroupForChildren, b => b
                    .usingKey(e => e.userId)));
    }
}
```
