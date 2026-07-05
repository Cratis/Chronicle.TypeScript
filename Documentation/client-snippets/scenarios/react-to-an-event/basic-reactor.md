```typescript
import { EventContext, eventType, reactor } from '@cratis/chronicle';

@eventType()
class ScenariosReactBookReturned {
    constructor(readonly isbn: string) {}
}

interface ScenariosReactNotificationService {
    notifyNextInLine(bookId: string): Promise<void>;
    notifyNextInLine(bookId: string, bookTitle: string): Promise<void>;
}

@reactor()
class ScenariosReactWaitlistNotifier {
    constructor(private readonly notifications: ScenariosReactNotificationService) {}

    // Method name must be the exact camelCase of the event's class name -
    // Chronicle discovers handlers by name, not by parameter type.
    async scenariosReactBookReturned(event: ScenariosReactBookReturned, context: EventContext): Promise<void> {
        // context.eventSourceId is the source the event happened to (the book)
        await this.notifications.notifyNextInLine(context.eventSourceId);
    }
}
```
