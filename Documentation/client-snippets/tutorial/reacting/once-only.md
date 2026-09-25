```typescript
import { EventContext, onceOnly, reactor } from '@cratis/chronicle';

// BookReturned is the event defined earlier in the tutorial.
@reactor()
class WaitlistNotifierOnceOnly {
    @onceOnly()
    async bookReturned(event: BookReturned, context: EventContext): Promise<void> {
        await notifyNextInLine(context.eventSourceId);
    }
}
```
