```typescript
import { EventContext, onceOnly, reactor } from '@cratis/chronicle';

@reactor()
class GetStartedBookReturnedNotifier {
    // Without @handles(EventType), the method name must be the exact camelCase of the
    // event's class name - Chronicle discovers undecorated handlers by name, not by parameter type.
    @onceOnly()
    async getStartedBookReturned(event: GetStartedBookReturned, context: EventContext): Promise<void> {
        // context.eventSourceId is the bookId this happened to
        console.log(`Book ${context.eventSourceId} was returned — notify the next member in line.`);
    }
}
```
