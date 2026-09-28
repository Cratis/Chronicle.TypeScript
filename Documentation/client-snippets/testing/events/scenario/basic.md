```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle';
import { EventScenario as BasicEventScenario } from '@cratis/chronicle/testing';

class MessageRecorded {
    @field(String) label: string;
    constructor(label: string) { this.label = label; }
}
eventType('MessageRecorded')(MessageRecorded);

const basicScenario = new BasicEventScenario({
    artifacts: { eventTypes: [MessageRecorded] },
    constraints: 'disabled'
});
const basicResult = await basicScenario.append('message-1', new MessageRecorded('hello'));
const basicHistory = basicScenario.appendedEvents;
// basicResult.isSuccess is true; basicHistory contains the serialized event.
// Unscoped single-string-property and unique-event-type constraints can be tested
// with constraints enabled. Observer completion still requires a kernel-backed test.
```
