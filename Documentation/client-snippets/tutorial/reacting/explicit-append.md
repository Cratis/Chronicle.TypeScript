```typescript
import { EventContext, ReactorServices, onceOnly, reactor } from '@cratis/chronicle';

@reactor()
class WaitlistNotifierExplicitAppend {
    @onceOnly()
    async bookReturned(event: BookReturned, context: EventContext, services: ReactorServices): Promise<void> {
        await notifyNextInLine(context.eventSourceId);
        const result = await services.eventStore.eventLog.append(context.eventSourceId, new WaitlistNotificationSent());
        if (!result.isSuccess) throw new Error(`Notification for book ${context.eventSourceId} was not recorded`);
    }
}
```
