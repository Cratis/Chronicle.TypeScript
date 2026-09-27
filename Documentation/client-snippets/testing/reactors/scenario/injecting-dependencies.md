```typescript
import { field } from '@cratis/fundamentals';
import { eventType, reactor } from '@cratis/chronicle';
import { ReactorScenario } from '@cratis/chronicle/testing';

class InjectedWelcomeRequested {
    @field(String) name: string;
    constructor(name: string) { this.name = name; }
}
eventType('InjectedWelcomeRequested')(InjectedWelcomeRequested);
const sent: string[] = [];
class InjectedWelcomeReactor {
    constructor(private readonly notifier: { send(name: string): void }) {}
    injectedWelcomeRequested(event: InjectedWelcomeRequested) { this.notifier.send(event.name); }
}
reactor('InjectedWelcomeReactor')(InjectedWelcomeReactor);
const injectedScenario = new ReactorScenario(InjectedWelcomeReactor, {
    artifacts: { eventTypes: [InjectedWelcomeRequested] }, constraints: 'disabled',
    artifactActivator: type => ({ instance: new type({ send: (name: string) => sent.push(name) }) })
});
await injectedScenario.when.forEventSource('customer-1').events(new InjectedWelcomeRequested('alice'));
// sent contains 'alice'; activation uses the same hook as the production client.
```
