```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class GroupCreatedWithEventParentKey {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class UserAddedWithEventParentKey {
    @field(String) readonly groupId: string;
    @field(String) readonly userId: string;
    @field(String) readonly role: string;

    constructor(groupId: string, userId: string, role: string) {
        this.groupId = groupId;
        this.userId = userId;
        this.role = role;
    }
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
