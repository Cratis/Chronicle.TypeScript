```typescript
import { IEventStore } from '@cratis/chronicle';

class ComplianceReadModelsEmployeeService {
    constructor(private readonly eventStore: IEventStore) {}

    getEmployee(id: string): Promise<ComplianceReadModelsEmployee | null> {
        return this.eventStore.readModels.findInstanceById(ComplianceReadModelsEmployee, id);
    }
}
```
