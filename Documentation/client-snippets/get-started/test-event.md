```typescript title="The event - an immutable fact"
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class TestEvent {
    @field(String) message: string;
    constructor(message: string) { this.message = message; }
}
```
