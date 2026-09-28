```typescript
import { field } from '@cratis/fundamentals';
import { eventType, unique } from '@cratis/chronicle';
import { EventScenario } from '@cratis/chronicle/testing';

class DistinctEmailRegistered {
    @field(String) @unique('DistinctEmail') email: string;
    constructor(email: string) { this.email = email; }
}
eventType('DistinctEmailRegistered')(DistinctEmailRegistered);

const distinctScenario = new EventScenario({ artifacts: { eventTypes: [DistinctEmailRegistered] } });
await distinctScenario.given.forEventSource('first').events(new DistinctEmailRegistered('alice'));
const distinctResult = await distinctScenario.when.forEventSource('second').event(new DistinctEmailRegistered('bob'));
if (!distinctResult.isSuccess || distinctResult.constraintViolations.length !== 0) {
    throw new Error('Different string values should be allowed');
}
```
