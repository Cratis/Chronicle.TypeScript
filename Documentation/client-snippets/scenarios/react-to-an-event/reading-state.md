```typescript
import { EventContext, ReactorServices, readModel, reactor } from '@cratis/chronicle';

@readModel()
class ScenariosReactBook {
    title = '';
}

@reactor()
class ScenariosReactWaitlistNotifierWithTitle {
    // Constructor injection requires an artifactActivator in ChronicleOptions.
    constructor(private readonly notifications: ScenariosReactNotificationService) {}

    async scenariosReactBookReturned(event: ScenariosReactBookReturned, context: EventContext, services: ReactorServices): Promise<void> {
        // Eventually consistent: this read may not yet include the triggering event.
        const book = await services.readModels.findInstanceById(ScenariosReactBook, context.eventSourceId);
        if (book === null) throw new Error(`Book ${context.eventSourceId} is not available yet`);
        await this.notifications.notifyNextInLine(context.eventSourceId, book.title);
    }
}
```
