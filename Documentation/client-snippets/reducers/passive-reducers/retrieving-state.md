```typescript
import { IEventStore } from '@cratis/chronicle';

class PassiveReducersReportingService {
    constructor(private readonly store: IEventStore) {}

    // This triggers the passive reducer to compute state from events
    generateReport(reportId: string): Promise<PassiveReducersMonthlyRevenueReport> {
        return this.store.readModels.getInstanceById(PassiveReducersMonthlyRevenueReport, reportId);
    }
}
```
