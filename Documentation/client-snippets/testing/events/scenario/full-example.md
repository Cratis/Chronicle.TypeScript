```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle';
import { EventScenario as CompleteEventScenario } from '@cratis/chronicle/testing';

class CompleteMessageRecorded {
    @field(String) label: string;
    constructor(label: string) { this.label = label; }
}
eventType('CompleteMessageRecorded')(CompleteMessageRecorded);

const completeScenario = new CompleteEventScenario({
    artifacts: { eventTypes: [CompleteMessageRecorded] }, constraints: 'disabled'
});
await completeScenario.given.forEventSource('message-1').events(new CompleteMessageRecorded('before'));
const completeResults = await completeScenario.when.forEventSource('message-1').events(
    new CompleteMessageRecorded('first'), new CompleteMessageRecorded('second'));
const completeHistory = completeScenario.appendedEvents;
// Setup is sequential; the two action events are one atomic batch.
// completeResults has two items; completeHistory has three accepted events.
```
