```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ProjectCreatedWithNestedChildren {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class TaskAddedWithNestedChild {
    @field(String) readonly taskId: string;
    @field(String) readonly title: string;

    constructor(taskId: string, title: string) {
        this.taskId = taskId;
        this.title = title;
    }
}

@eventType()
class TaskAssignedWithNestedChild {
    @field(String) readonly taskId: string;
    @field(String) readonly name: string;
    @field(String) readonly email: string;

    constructor(taskId: string, name: string, email: string) {
        this.taskId = taskId;
        this.name = name;
        this.email = email;
    }
}

@eventType()
class TaskUnassignedWithNestedChild {
    @field(String) readonly taskId: string;

    constructor(taskId: string) {
        this.taskId = taskId;
    }
}

class AssigneeForNestedChild {
    name = '';
    email = '';
}

class TaskWithNestedAssignee {
    taskId = '';
    title = '';
    assignee: AssigneeForNestedChild | null = null;
}

class ProjectWithDeclarativeNestedChildren {
    name = '';
    tasks: TaskWithNestedAssignee[] = [];
}

@projection()
class ProjectProjectionWithDeclarativeNestedChildren implements IProjectionFor<ProjectWithDeclarativeNestedChildren> {
    define(builder: IProjectionBuilderFor<ProjectWithDeclarativeNestedChildren>): void {
        builder
            .from(ProjectCreatedWithNestedChildren)
            .children<TaskWithNestedAssignee>(m => m.tasks, tasks => tasks
                .identifiedBy(m => m.taskId)
                .from(TaskAddedWithNestedChild, b => b
                    .usingKey(e => e.taskId))
                .nested(m => m.assignee, assignee => assignee
                    .from(TaskAssignedWithNestedChild, b => b
                        .usingKey(e => e.taskId))
                    .clearWith(TaskUnassignedWithNestedChild)));
    }
}
```
