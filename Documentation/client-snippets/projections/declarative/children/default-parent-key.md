```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class GroupCreatedWithDefaultParentKey {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class UserAddedWithDefaultParentKey {
    @field(String) readonly userId: string;
    @field(String) readonly role: string;

    constructor(userId: string, role: string) {
        this.userId = userId;
        this.role = role;
    }
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
