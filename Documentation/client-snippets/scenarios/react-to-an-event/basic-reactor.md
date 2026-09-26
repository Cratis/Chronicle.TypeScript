```typescript
import { EventContext, eventType, onceOnly, reactor } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class ScenariosReactBookReturned {
    @field(String) readonly isbn: string;

    constructor(isbn: string) {
        this.isbn = isbn;
    }
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
    @onceOnly()
    async scenariosReactBookReturned(event: ScenariosReactBookReturned, context: EventContext): Promise<void> {
        // context.eventSourceId is the source the event happened to (the book)
        await this.notifications.notifyNextInLine(context.eventSourceId);
    }
}
```
