```typescript
import { field } from '@cratis/fundamentals';
import { eventType, unique } from '@cratis/chronicle';
import { EventScenario } from '@cratis/chronicle/testing';

class ConstraintEmailRegistered {
    @field(String) @unique('ConstraintEmail', 'Already used: {PropertyValue}') email: string;
    constructor(email: string) { this.email = email; }
}
eventType('ConstraintEmailRegistered')(ConstraintEmailRegistered);

const constraintScenario = new EventScenario({ artifacts: { eventTypes: [ConstraintEmailRegistered] } });
await constraintScenario.given.forEventSource('first').events(new ConstraintEmailRegistered('alice'));
const constraintResult = await constraintScenario.when.forEventSource('second').event(new ConstraintEmailRegistered('alice'));
if (constraintResult.isSuccess || constraintResult.constraintViolations[0]?.message !== 'Already used: alice') {
    throw new Error('Expected an unscoped unique-value violation');
}
// No second event was committed; rejected sequence numbers normalize to 0n.
```
