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
// Constraints and observer completion require a kernel-backed test.
```
