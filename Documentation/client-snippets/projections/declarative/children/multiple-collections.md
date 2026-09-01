```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class GroupCreatedWithMultipleCollections {
    constructor(readonly name: string) {}
}

@eventType()
class MemberAddedToGroup {
    constructor(readonly userId: string, readonly role: string) {}
}

@eventType()
class TaskAssignedToGroup {
    constructor(readonly taskId: string, readonly title: string) {}
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
