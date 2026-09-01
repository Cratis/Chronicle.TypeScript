```typescript
import { childrenFrom, clearWith, eventType, fromEvent, Guid, nested } from '@cratis/chronicle';

@eventType()
class TaskAddedForNestedChildren {
    constructor(readonly taskId: Guid, readonly title: string) {}
}

@eventType()
class TaskAssignedForNestedChildren {
    constructor(readonly taskId: Guid, readonly name: string, readonly email: string) {}
}

@eventType()
class TaskUnassignedForNestedChildren {
    constructor(readonly taskId: Guid) {}
}

@fromEvent(TaskAssignedForNestedChildren)
@clearWith(TaskUnassignedForNestedChildren)
class TaskAssigneeNestedChild {
    name = '';
    email = '';
}

class ProjectTaskWithNestedAssignee {
    taskId: Guid = Guid.empty;
    title = '';

    @nested
    assignee: TaskAssigneeNestedChild | null = null;
}

class ProjectWithNestedChildren {
    id: Guid = Guid.empty;
    name = '';

    @childrenFrom(TaskAddedForNestedChildren, 'taskId')
    tasks: ProjectTaskWithNestedAssignee[] = [];
}
```
