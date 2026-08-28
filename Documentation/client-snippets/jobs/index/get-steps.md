```typescript
import { IEventStore } from '@cratis/chronicle';
import { JobStepSummaryResponse } from '@cratis/chronicle.contracts';

class JobsIndexGetSteps {
    constructor(private readonly store: IEventStore) {}

    async getSteps(jobId: string): Promise<JobStepSummaryResponse[]> {
        return this.store.jobs.getJobSteps(jobId);
    }
}
```
