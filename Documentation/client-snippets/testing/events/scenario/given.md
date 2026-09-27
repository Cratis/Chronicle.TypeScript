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
await givenScenario.given.forEventSource('message-1').events(new MessageSeeded('first'));
await givenScenario.given.forEventSource('message-1').events(new MessageSeeded('second'));
// Setup events enter appendedEvents, not results. Pass exactly one event per call.
```
