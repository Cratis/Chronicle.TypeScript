```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class ProjectCreatedWithNestedChildren {
    constructor(readonly name: string) {}
}

@eventType()
class TaskAddedWithNestedChild {
    constructor(readonly taskId: string, readonly title: string) {}
}

@eventType()
class TaskAssignedWithNestedChild {
    constructor(readonly taskId: string, readonly name: string, readonly email: string) {}
}

@eventType()
class TaskUnassignedWithNestedChild {
    constructor(readonly taskId: string) {}
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
