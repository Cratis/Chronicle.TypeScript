```typescript
import { IEventStore } from '@cratis/chronicle';
import { JobStep } from '@cratis/chronicle.contracts';

class JobsIndexGetSteps {
    constructor(private readonly store: IEventStore) {}

    async getSteps(jobId: string): Promise<JobStep[]> {
        return this.store.jobs.getJobSteps(jobId);
    }
}
```
