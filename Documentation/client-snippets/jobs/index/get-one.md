```typescript
import { IEventStore } from '@cratis/chronicle';
import { Job } from '@cratis/chronicle.contracts';

class JobsIndexGetOne {
    constructor(private readonly store: IEventStore) {}

    async getJob(jobId: string): Promise<Job | undefined> {
        return this.store.jobs.getJob(jobId);
    }
}
```
