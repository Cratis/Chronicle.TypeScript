```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class GroupCreatedWithRemoval {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class UserAddedWithRemoval {
    @field(String) readonly userId: string;
    @field(String) readonly role: string;

    constructor(userId: string, role: string) {
        this.userId = userId;
        this.role = role;
    }
}

@eventType()
class UserRemovedWithRemoval {
    @field(String) readonly userId: string;

    constructor(userId: string) {
        this.userId = userId;
    }
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
