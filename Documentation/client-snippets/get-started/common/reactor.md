```typescript
import { EventContext, reactor } from '@cratis/chronicle';

@reactor()
class GetStartedBookReturnedNotifier {
    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    async getStartedBookReturned(event: GetStartedBookReturned, context: EventContext): Promise<void> {
        // context.eventSourceId is the bookId this happened to
        console.log(`Book ${context.eventSourceId} was returned — notify the next member in line.`);
    }
}
```
