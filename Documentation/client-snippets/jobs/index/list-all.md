```typescript
import { IEventStore } from '@cratis/chronicle';
import { Job } from '@cratis/chronicle.contracts';

class JobsIndexListAll {
    constructor(private readonly store: IEventStore) {}

    async getAllJobs(): Promise<Job[]> {
        return this.store.jobs.getJobs();
    }
}
```
