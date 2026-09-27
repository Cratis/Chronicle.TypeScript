```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle';
import { reactor } from '@cratis/chronicle';
import { ReactorScenario } from '@cratis/chronicle/testing';

class BasicWelcomeRequested {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}
eventType('BasicWelcomeRequested')(BasicWelcomeRequested);

class BasicWelcomeReactor {
    basicWelcomeRequested(event: BasicWelcomeRequested) { return new BasicWelcomeRequested(event.name); }
}
reactor('BasicWelcomeReactor')(BasicWelcomeReactor);

const basicReactorScenario = new ReactorScenario(BasicWelcomeReactor, {
    artifacts: { eventTypes: [BasicWelcomeRequested] }, constraints: 'disabled'
});
await basicReactorScenario.given.forEventSource('customer-1').events(new BasicWelcomeRequested('alice'));
await basicReactorScenario.when.forEventSource('customer-2').events(new BasicWelcomeRequested('bob'));
// Both deliveries complete immediately; returned events are recorded, not appended.
```
