```typescript
import { IEventStore } from '@cratis/chronicle';

class JobsIndexStopResumeDelete {
    constructor(private readonly store: IEventStore) {}

    async stopJob(jobId: string): Promise<void> {
        await this.store.jobs.stop(jobId);
    }

    async resumeJob(jobId: string): Promise<void> {
        await this.store.jobs.resume(jobId);
    }

    async deleteJob(jobId: string): Promise<void> {
        await this.store.jobs.delete(jobId);
    }
}
```
