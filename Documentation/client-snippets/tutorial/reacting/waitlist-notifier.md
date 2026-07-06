```typescript
import { EventContext, reactor } from '@cratis/chronicle';

async function notifyNextInLine(bookId: string): Promise<void> {
    console.log(`Notify next in line for book ${bookId}`);
}

@reactor()
class WaitlistNotifier {
    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    async bookReturned(event: BookReturned, context: EventContext): Promise<void> {
        // context.eventSourceId is the bookId this happened to
        await notifyNextInLine(context.eventSourceId);
    }
}
```
