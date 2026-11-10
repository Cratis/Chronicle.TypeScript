```typescript
import { eventType, Guid, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecOrderingCommentPosted {
    commentId: Guid = Guid.empty;
    text = '';
}

@eventType()
class DecOrderingTaskAdded {
    taskId: Guid = Guid.empty;
    title = '';
    priority = 0;
}

class DecOrderingComment {
    commentId: Guid = Guid.empty;
    text = '';
}

class DecOrderingTask {
    taskId: Guid = Guid.empty;
    title = '';
    priority = 0;
}

class DecOrderingBoard {
    comments: DecOrderingComment[] = [];
    tasks: DecOrderingTask[] = [];
}

@projection()
class DecOrderingBoardProjection implements IProjectionFor<DecOrderingBoard> {
    define(builder: IProjectionBuilderFor<DecOrderingBoard>): void {
        builder
            .children<DecOrderingComment>(m => m.comments, children => children
                .identifiedBy(c => c.commentId)
                .prepend()
                .from(DecOrderingCommentPosted, _ => _.usingKey(e => e.commentId)))
            .children<DecOrderingTask>(m => m.tasks, children => children
                .identifiedBy(t => t.taskId)
                .orderByDescending(t => t.priority)
                .from(DecOrderingTaskAdded, _ => _.usingKey(e => e.taskId)));
    }
}
```
