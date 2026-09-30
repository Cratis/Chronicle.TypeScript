```typescript title="Clear a member of a child item"
import { childrenFrom, eventType, fromEvent, Guid, setFrom, setValue } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class MbClearingTaskListStarted {
    @field(String) readonly name: string;

    constructor(name: string) { this.name = name; }
}

@eventType()
class MbClearingTaskAdded {
    @field(Guid) readonly listId: Guid;
    @field(Guid) readonly taskId: Guid;
    @field(String) readonly title: string;
    @field(String) readonly due: string;

    constructor(listId: Guid, taskId: Guid, title: string, due: string) {
        this.listId = listId;
        this.taskId = taskId;
        this.title = title;
        this.due = due;
    }
}

@eventType()
class MbClearingTaskDeferred {
    @field(Guid) readonly listId: Guid;
    @field(Guid) readonly taskId: Guid;

    constructor(listId: Guid, taskId: Guid) {
        this.listId = listId;
        this.taskId = taskId;
    }
}

class MbClearingTask {
    id: Guid = Guid.empty;

    @setFrom(MbClearingTaskAdded, 'title')
    title = '';

    @field(String) @setFrom(MbClearingTaskAdded, 'due') @setValue(MbClearingTaskDeferred, null)
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
