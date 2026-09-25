```typescript title="The reactor - does something when it happens"
import { onceOnly, reactor } from '@cratis/chronicle';

@reactor()
class TestReactor {
    @onceOnly()
    async testEvent(event: TestEvent): Promise<void> {
        console.log(`Received event with message: ${event.message}`);
    }
}
```
