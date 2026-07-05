```typescript title="The event - an immutable fact"
import { eventType } from '@cratis/chronicle';

@eventType()
class TestEvent {
    constructor(readonly message: string) {}
}
```
