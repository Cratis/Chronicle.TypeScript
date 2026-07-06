```typescript
import { IEventStore } from '@cratis/chronicle';

class EventsIndexEmployeesService {
    constructor(private readonly store: IEventStore) {}

    async registerEmployee(employeeId: string, firstName: string, lastName: string): Promise<void> {
        await this.store.eventLog.append(employeeId, new EventsIndexEmployeeRegistered(firstName, lastName));
    }
}
```
