```typescript
import { field } from '@cratis/fundamentals';
import { eventType, reactor } from '@cratis/chronicle';
import { ReactorScenario } from '@cratis/chronicle/testing';

class TestingPerRunReactorEvent {
    @field(String) value: string;
    constructor(value: string) { this.value = value; }
}
eventType('TestingPerRunReactorEvent')(TestingPerRunReactorEvent);

class TestingPerRunReactor {
    testingPerRunReactorEvent(event: TestingPerRunReactorEvent) { }
}
reactor('TestingPerRunReactor')(TestingPerRunReactor);

// Each scenario takes its own artifacts, so runs do not share discovered event types.
const perRunReactorScenario = new ReactorScenario(TestingPerRunReactor, {
    artifacts: { eventTypes: [TestingPerRunReactorEvent] }, constraints: 'disabled'
});
await perRunReactorScenario.given.forEventSource('example-1').events(new TestingPerRunReactorEvent('example'));
```
