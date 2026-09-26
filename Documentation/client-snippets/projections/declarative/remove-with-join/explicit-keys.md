```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class DecRemoveWithJoinExplicitEmployeeHired {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class DecRemoveWithJoinExplicitEmployeeAssignedToProject {
    @field(String) readonly employeeId: string;
    @field(String) readonly projectId: string;

    constructor(employeeId: string, projectId: string) {
        this.employeeId = employeeId;
        this.projectId = projectId;
    }
}

@eventType()
class DecRemoveWithJoinExplicitProjectCreated {
    @field(String) readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}

@eventType()
class DecRemoveWithJoinExplicitProjectCancelled {
    @field(String) readonly projectId: string;

    constructor(projectId: string) {
        this.projectId = projectId;
    }
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
