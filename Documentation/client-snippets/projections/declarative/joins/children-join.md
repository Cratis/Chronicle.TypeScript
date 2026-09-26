```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class DecJoinsChildTaskAssigned {
    @field(String) readonly taskId: string;
    @field(String) readonly projectId: string;

    constructor(taskId: string, projectId: string) {
        this.taskId = taskId;
        this.projectId = projectId;
    }
}

@eventType()
class DecJoinsChildProjectCreated {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
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
