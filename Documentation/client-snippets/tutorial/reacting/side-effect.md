```typescript
import { EventContext, reactor } from '@cratis/chronicle';

@reactor()
class WaitlistNotifierSideEffect {
    // Returning the event appends it for you, against the triggering event's own
    // event source id - the book that was returned.
    async bookReturned(event: BookReturned, context: EventContext): Promise<WaitlistNotificationSent> {
        await notifyNextInLine(context.eventSourceId);
        return new WaitlistNotificationSent();
    }
}
```
