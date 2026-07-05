```typescript title="AutoMap with a join"
import { eventType, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';

@eventType()
class AutoMapEmployeeHired {
    constructor(readonly employeeName: string, readonly departmentId: string) {}
}

@eventType()
class AutoMapDepartmentRenamed {
    constructor(readonly departmentName: string) {}
}

@readModel()
class AutoMapEmployee {
    employeeName = '';
    departmentId = '';
    departmentName = '';
}

@projection('', AutoMapEmployee)
class AutoMapEmployeeProjection implements IProjectionFor<AutoMapEmployee> {
    define(builder: IProjectionBuilderFor<AutoMapEmployee>): void {
        builder
            .from(AutoMapEmployeeHired)
            .join(AutoMapDepartmentRenamed, _ => _
                .on(m => m.departmentId));
    }
}
```
