```typescript title="Clear a member of a child item"
import { childrenFrom, clearWith, eventType, fromEvent, Guid, setFrom } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class MbClearingTaskListStarted {
    @field(String) readonly name: string;

    constructor(name: string) { this.name = name; }
}

@eventType()
class MbClearingTaskAdded {
    @field(String) readonly listId: string;
    @field(String) readonly taskId: string;
    @field(String) readonly title: string;
    @field(String) readonly due: string;

    constructor(listId: string, taskId: string, title: string, due: string) {
        this.listId = listId;
        this.taskId = taskId;
        this.title = title;
        this.due = due;
    }
}

@eventType()
class MbClearingTaskDeferred {
    @field(String) readonly listId: string;
    @field(String) readonly taskId: string;

    constructor(listId: string, taskId: string) {
        this.listId = listId;
        this.taskId = taskId;
    }
}

class MbClearingTask {
    id: Guid = Guid.empty;

    @setFrom(MbClearingTaskAdded, 'title')
    title = '';

    @field(String) @setFrom(MbClearingTaskAdded, 'due') @clearWith(MbClearingTaskDeferred)
    due: string | null = null;
}

@fromEvent(MbClearingTaskListStarted)
class MbClearingTaskList {
    id: Guid = Guid.empty;

    @childrenFrom(MbClearingTaskAdded, 'taskId', 'id', 'listId')
    @childrenFrom(MbClearingTaskDeferred, 'taskId', 'id', 'listId')
    @field(Array, { genericArguments: [MbClearingTask] })
    tasks: MbClearingTask[] = [];
}
```
