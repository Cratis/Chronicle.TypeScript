```typescript
import { field } from '@cratis/fundamentals';
import { eventType, reactor } from '@cratis/chronicle';
import { ReactorScenario } from '@cratis/chronicle/testing';

class ProducedRegistration {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}
eventType('ProducedRegistration')(ProducedRegistration);
class ProducedNotification {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}
eventType('ProducedNotification')(ProducedNotification);
class ProducedReactor {
    producedRegistration(event: ProducedRegistration) {
        return { eventSourceId: 'notifications', event: new ProducedNotification(event.name) };
    }
}
reactor('ProducedReactor')(ProducedReactor);
const producedScenario = new ReactorScenario(ProducedReactor, {
    artifacts: { eventTypes: [ProducedRegistration, ProducedNotification] }, constraints: 'disabled'
});
await producedScenario.when.forEventSource('customer-1').events(new ProducedRegistration('alice'));
producedScenario.shouldHaveProduced(ProducedNotification, event => event.name === 'alice');
// producedScenario.sideEffects[0].target.eventSourceId === 'notifications'; no event is auto-appended.
```
