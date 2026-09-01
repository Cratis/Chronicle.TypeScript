```typescript
import { IEventStore } from '@cratis/chronicle';

class ComplianceReadModelsEmployeeService {
    constructor(private readonly eventStore: IEventStore) {}

    getEmployee(id: string): Promise<ComplianceReadModelsEmployee> {
        return this.eventStore.readModels.getInstanceById(ComplianceReadModelsEmployee, id);
    }
}
```
