```typescript
import { ChronicleOptions, EventContext, eventType, onceOnly, reactor, type ReactorResultHandler } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class CustomHandlerBookReserved {
    @field(String) readonly isbn: string;

    constructor(isbn: string = '') {
        this.isbn = isbn;
    }
}

// An application-owned result type that Chronicle does not append on its own.
class CustomHandlerSendReminder {
    constructor(readonly isbn: string) {}
}

@reactor()
class CustomHandlerReminderReactor {
    @onceOnly()
    async customHandlerBookReserved(event: CustomHandlerBookReserved, context: EventContext): Promise<CustomHandlerSendReminder> {
        return new CustomHandlerSendReminder(event.isbn);
    }
}

// Runs before Chronicle appends returned events. Return true only after handling the whole
// result; return false to let Chronicle append the events it recognizes.
const customHandlerReactorResults: ReactorResultHandler = async (result, context) => {
    if (!(result instanceof CustomHandlerSendReminder)) return false;
    console.log(`Remind ${context.eventSourceId} about ${result.isbn}`);
    return true;
};

const customHandlerOptions = ChronicleOptions.development({ reactorResultHandler: customHandlerReactorResults });
```
