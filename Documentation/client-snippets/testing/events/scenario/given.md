```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle';
import { EventScenario as GivenEventScenario } from '@cratis/chronicle/testing';

class MessageSeeded {
    @field(String) label: string;
    constructor(label: string) { this.label = label; }
}
eventType('MessageSeeded')(MessageSeeded);

const givenScenario = new GivenEventScenario({
    artifacts: { eventTypes: [MessageSeeded] },
    constraints: 'disabled'
});
await givenScenario.given.forEventSource('message-1').events(
    new MessageSeeded('first'), new MessageSeeded('second'));
// Given uses sequential single appends, not an atomic batch, but commits nothing if any setup event is rejected.
// Setup events enter appendedEvents, not results.
```
