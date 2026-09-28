```typescript
import { field } from '@cratis/fundamentals';
import { eventType, unique } from '@cratis/chronicle';
import { EventScenario } from '@cratis/chronicle/testing';

class BatchEmailRegistered {
    @field(String) @unique('BatchEmail') email: string;
    constructor(email: string) { this.email = email; }
}
eventType('BatchEmailRegistered')(BatchEmailRegistered);

const batchConstraintScenario = new EventScenario({ artifacts: { eventTypes: [BatchEmailRegistered] } });
const batchConstraintResults = await batchConstraintScenario.appendMany([
    { eventSourceId: 'first', event: new BatchEmailRegistered('alice') },
    { eventSourceId: 'second', event: new BatchEmailRegistered('alice') }
]);
if (batchConstraintResults.some(result => result.isSuccess) || batchConstraintScenario.appendedEvents.length !== 0) {
    throw new Error('A conflicting batch must not commit any events');
}
// Both results carry the batch-level violation; no sequence number was consumed.
```
