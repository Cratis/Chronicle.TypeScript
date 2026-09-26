```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class GroupCreatedWithContextParentKey {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class UserAddedWithContextParentKey {
    @field(String) readonly userId: string;
    @field(String) readonly role: string;

    constructor(userId: string, role: string) {
        this.userId = userId;
        this.role = role;
    }
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
