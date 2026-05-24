# Jobs

Use `eventStore.jobs` to inspect and control Chronicle jobs in a namespace.

## API

`eventStore.jobs` exposes:

- `stop(jobId)`
- `resume(jobId)`
- `delete(jobId)`
- `getJob(jobId)`
- `getJobs()`
- `getJobSteps(jobId)`

For `jobId`, you can pass:

- `JobId`
- `Guid`
- `string` (guid text)

## Example

```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

const client = new ChronicleClient(ChronicleOptions.development());
const eventStore = await client.getEventStore('MyStore');

const jobs = await eventStore.jobs.getJobs();
if (jobs.length > 0 && jobs[0].Id) {
    await eventStore.jobs.stop(jobs[0].Id.toString());
    await eventStore.jobs.resume(jobs[0].Id.toString());
}

client.dispose();
```

## Get a single job

`getJob(jobId)` returns `undefined` when the job is not found.

```typescript
const job = await eventStore.jobs.getJob('94ba2c17-0977-478e-a278-70f6757aac2d');
if (!job) {
    console.log('Job not found');
}
```
