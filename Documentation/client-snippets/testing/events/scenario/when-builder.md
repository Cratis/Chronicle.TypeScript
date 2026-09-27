```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle';
import { EventScenario as WhenEventScenario } from '@cratis/chronicle/testing';

class MessageActed {
    @field(String) label: string;
    constructor(label: string) { this.label = label; }
}
eventType('MessageActed')(MessageActed);

const whenScenario = new WhenEventScenario({
    artifacts: { eventTypes: [MessageActed] },
    constraints: 'disabled'
});
const whenResult = await whenScenario.when.forEventSource('message-1').event(new MessageActed('sent'));
// whenResult.isSuccess is true; whenScenario.then.results contains the act-phase result.
// The plural when.events(...) is a batch operation, not a single append.
```
