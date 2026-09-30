```typescript
import { EventContext, ReactorServices, reactor } from '@cratis/chronicle';

interface TutorialBookTitleNotifier {
    notifyNextInLine(bookId: string, title: string): Promise<void>;
}

@reactor()
class WaitlistNotifierWithBookTitle {
    // Constructor injection requires an artifactActivator in ChronicleOptions.
    constructor(private readonly notifications: TutorialBookTitleNotifier) {}

    async bookReturned(event: BookReturned, context: EventContext, services: ReactorServices): Promise<void> {
        // A read model may lag this event or not exist yet.
        const book = await services.readModels.findInstanceById(Book, context.eventSourceId);
        if (book === null) throw new Error(`Book ${context.eventSourceId} is not available yet`);
        await this.notifications.notifyNextInLine(context.eventSourceId, book.title);
    }
}
```
