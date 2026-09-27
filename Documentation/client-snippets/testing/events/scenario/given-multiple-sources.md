```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle';
import { EventScenario as MultiSourceEventScenario } from '@cratis/chronicle/testing';

class MultiSourceMessage {
    @field(String) label: string;
    constructor(label: string) { this.label = label; }
}
eventType('MultiSourceMessage')(MultiSourceMessage);

const multiSourceScenario = new MultiSourceEventScenario({
    artifacts: { eventTypes: [MultiSourceMessage] }, constraints: 'disabled'
});
await multiSourceScenario.given.forEventSource('message-1').events(new MultiSourceMessage('first'));
await multiSourceScenario.given.forEventSource('message-2').events(new MultiSourceMessage('second'));
// Each setup append is independent; given does not start an atomic batch.
```
