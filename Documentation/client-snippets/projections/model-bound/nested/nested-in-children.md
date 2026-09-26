```typescript
import { childrenFrom, clearWith, eventType, fromEvent, Guid, nested } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class TaskAddedForNestedChildren {
    @field(Guid) readonly taskId: Guid;
    @field(String) readonly title: string;

    constructor(taskId: Guid, title: string) {
        this.taskId = taskId;
        this.title = title;
    }
}

@eventType()
class TaskAssignedForNestedChildren {
    @field(Guid) readonly taskId: Guid;
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(taskId: Guid, name: string, email: string) {
        this.taskId = taskId;
        this.name = name;
        this.email = email;
    }
}

@eventType()
class TaskUnassignedForNestedChildren {
    @field(Guid) readonly taskId: Guid;

    constructor(taskId: Guid) {
        this.taskId = taskId;
    }
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
