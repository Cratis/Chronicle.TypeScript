```typescript
import { eventType, IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class DecJoinsMultipleEmployeeAssigned {
    groupId = '';
    departmentId = '';
    locationId = '';
}

@eventType()
class DecJoinsMultipleGroupCreated {
    name = '';
}

@eventType()
class DecJoinsMultipleDepartmentCreated {
    name = '';
}

@eventType()
class DecJoinsMultipleLocationUpdated {
    address = '';
}

class DecJoinsMultipleEmployeeSummary {
    groupId: string | null = null;
    groupName: string | null = null;
    departmentId: string | null = null;
    departmentName: string | null = null;
    locationId: string | null = null;
    locationAddress: string | null = null;
}

@projection()
class DecJoinsMultipleEmployeeSummaryProjection implements IProjectionFor<DecJoinsMultipleEmployeeSummary> {
    define(builder: IProjectionBuilderFor<DecJoinsMultipleEmployeeSummary>): void {
        builder
            .autoMap()
            .from(DecJoinsMultipleEmployeeAssigned)
            .join(DecJoinsMultipleGroupCreated, j => j.on(m => m.groupId))
            .join(DecJoinsMultipleDepartmentCreated, j => j.on(m => m.departmentId))
            .join(DecJoinsMultipleLocationUpdated, j => j.on(m => m.locationId));
    }
}
```
