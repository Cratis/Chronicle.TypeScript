```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class GroupCreatedWithMultipleCollections {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class MemberAddedToGroup {
    @field(String) readonly userId: string;
    @field(String) readonly role: string;

    constructor(userId: string, role: string) {
        this.userId = userId;
        this.role = role;
    }
}

@eventType()
class TaskAssignedToGroup {
    @field(String) readonly taskId: string;
    @field(String) readonly title: string;

    constructor(taskId: string, title: string) {
        this.taskId = taskId;
        this.title = title;
    }
}

class GroupMemberInMultipleCollections {
    userId = '';
    role = '';
}

class GroupTaskInMultipleCollections {
    taskId = '';
    title = '';
}

class GroupWithMultipleCollections {
    name = '';
    members: GroupMemberInMultipleCollections[] = [];
    tasks: GroupTaskInMultipleCollections[] = [];
}

@projection()
class GroupWithMultipleCollectionsProjection implements IProjectionFor<GroupWithMultipleCollections> {
    define(builder: IProjectionBuilderFor<GroupWithMultipleCollections>): void {
        builder
            .from(GroupCreatedWithMultipleCollections)
            .children<GroupMemberInMultipleCollections>(m => m.members, children => children
                .identifiedBy(m => m.userId)
                .from(MemberAddedToGroup, b => b
                    .usingKey(e => e.userId)))
            .children<GroupTaskInMultipleCollections>(m => m.tasks, children => children
                .identifiedBy(m => m.taskId)
                .from(TaskAssignedToGroup, b => b
                    .usingKey(e => e.taskId)));
    }
}
```
