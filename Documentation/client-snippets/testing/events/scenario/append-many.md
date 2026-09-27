```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle';
import { EventScenario as BatchEventScenario } from '@cratis/chronicle/testing';

class BatchMessageRecorded {
    @field(String) label: string;
    constructor(label: string) { this.label = label; }
}
eventType('BatchMessageRecorded')(BatchMessageRecorded);

const batchScenario = new BatchEventScenario({
    artifacts: { eventTypes: [BatchMessageRecorded] }, constraints: 'disabled'
});
const oneSource = await batchScenario.appendMany('message-1', [
    new BatchMessageRecorded('first'), new BatchMessageRecorded('second')
]);
const multipleSources = await batchScenario.appendMany([
    { eventSourceId: 'message-1', event: new BatchMessageRecorded('third'), subject: 'message-1' },
    { eventSourceId: 'message-2', event: new BatchMessageRecorded('fourth') }
]);
// Each batch is atomic; oneSource and multipleSources contain one AppendResult per event.
// Constraint-bearing batches still require a kernel-backed test.
```
