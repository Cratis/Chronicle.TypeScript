```typescript
import { IEventStore } from '@cratis/chronicle';
import { JobSummaryResponse } from '@cratis/chronicle.contracts';

class JobsIndexListAll {
    constructor(private readonly store: IEventStore) {}

    async getAllJobs(): Promise<JobSummaryResponse[]> {
        return this.store.jobs.getJobs();
    }
}
```
