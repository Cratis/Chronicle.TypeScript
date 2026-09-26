```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class GroupCreatedForChildren {
    @field(String) readonly name: string;
    @field(String) readonly description: string;

    constructor(name: string, description: string) {
        this.name = name;
        this.description = description;
    }
}

@eventType()
class UserAddedToGroupForChildren {
    @field(String) readonly userId: string;
    @field(String) readonly role: string;

    constructor(userId: string, role: string) {
        this.userId = userId;
        this.role = role;
    }
}

@eventType()
class UserRoleChangedForChildren {
    @field(String) readonly userId: string;
    @field(String) readonly role: string;

    constructor(userId: string, role: string) {
        this.userId = userId;
        this.role = role;
    }
}

@eventType()
class UserRemovedFromGroupForChildren {
    @field(String) readonly userId: string;

    constructor(userId: string) {
        this.userId = userId;
    }
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
