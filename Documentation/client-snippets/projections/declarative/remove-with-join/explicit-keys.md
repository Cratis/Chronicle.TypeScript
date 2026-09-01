```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecRemoveWithJoinExplicitEmployeeHired {
    constructor(readonly name: string) {}
}

@eventType()
class DecRemoveWithJoinExplicitEmployeeAssignedToProject {
    constructor(readonly employeeId: string, readonly projectId: string) {}
}

@eventType()
class DecRemoveWithJoinExplicitProjectCreated {
    constructor(readonly name: string) {}
}

@eventType()
class DecRemoveWithJoinExplicitProjectCancelled {
    constructor(readonly projectId: string) {}
}

class DecRemoveWithJoinExplicitEmployeeProject {
    projectId = '';
    name = '';
    assignedAt = new Date();
}

class DecRemoveWithJoinExplicitEmployee {
    name = '';
    projects: DecRemoveWithJoinExplicitEmployeeProject[] = [];
}

@projection()
class DecRemoveWithJoinExplicitEmployeeProjection implements IProjectionFor<DecRemoveWithJoinExplicitEmployee> {
    define(builder: IProjectionBuilderFor<DecRemoveWithJoinExplicitEmployee>): void {
        builder
            .autoMap()
            .from(DecRemoveWithJoinExplicitEmployeeHired)
            .children<DecRemoveWithJoinExplicitEmployeeProject>(m => m.projects, children => children
                .identifiedBy(e => e.projectId)
                .autoMap()
                .from(DecRemoveWithJoinExplicitEmployeeAssignedToProject, _ => _
                    .usingParentKey(e => e.employeeId)
                    .usingKey(e => e.projectId)
                    .set(m => m.assignedAt).toEventContextProperty('occurred'))
                .join(DecRemoveWithJoinExplicitProjectCreated, _ => _
                    .on(m => m.projectId))
                .removedWithJoin(DecRemoveWithJoinExplicitProjectCancelled, _ => _
                    .usingKey(e => e.projectId)));
    }
}
```
