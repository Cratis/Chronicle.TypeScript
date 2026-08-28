```typescript
import { IEventStore } from '@cratis/chronicle';
import { JobSummaryResponse } from '@cratis/chronicle.contracts';

class JobsIndexGetOne {
    constructor(private readonly store: IEventStore) {}

    async getJob(jobId: string): Promise<JobSummaryResponse | undefined> {
        return this.store.jobs.getJob(jobId);
    }
}
```
