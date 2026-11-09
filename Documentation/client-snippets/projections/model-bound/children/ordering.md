```typescript
import { childrenFrom, eventType, Guid } from '@cratis/chronicle';

@eventType()
class CommentPostedForOrdering {
    commentId: Guid = Guid.empty;
    text = '';
}

@eventType()
class TaskAddedForOrdering {
    taskId: Guid = Guid.empty;
    title = '';
    priority = 0;
}

class OrderedComment {
    commentId: Guid = Guid.empty;
    text = '';
}

class OrderedTask {
    taskId: Guid = Guid.empty;
    title = '';
    priority = 0;
}

class OrderedBoard {
    id: Guid = Guid.empty;

    @childrenFrom(CommentPostedForOrdering, { childType: OrderedComment, key: 'commentId', identifiedBy: 'commentId', prepend: true })
    comments: OrderedComment[] = [];

    @childrenFrom(TaskAddedForOrdering, { childType: OrderedTask, key: 'taskId', identifiedBy: 'taskId', orderByDescending: 'priority' })
    tasks: OrderedTask[] = [];
}
```
