```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecJoinsChildTaskAssigned {
    constructor(readonly taskId: string, readonly projectId: string) {}
}

@eventType()
class DecJoinsChildProjectCreated {
    constructor(readonly name: string) {}
}

class DecJoinsChildTask {
    taskId = '';
    projectId = '';
    projectName: string | null = null;
}

class DecJoinsChildProjectBoard {
    tasks: DecJoinsChildTask[] = [];
}

@projection()
class DecJoinsChildProjectBoardProjection implements IProjectionFor<DecJoinsChildProjectBoard> {
    define(builder: IProjectionBuilderFor<DecJoinsChildProjectBoard>): void {
        builder
            .children<DecJoinsChildTask>(m => m.tasks, children => children
                .identifiedBy(e => e.taskId)
                .autoMap()
                .from(DecJoinsChildTaskAssigned, b => b
                    .usingKey(e => e.taskId))
                .join(DecJoinsChildProjectCreated, j => j
                    .on(m => m.projectId)));
    }
}
```
