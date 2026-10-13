```typescript
import { EventContext, pii, reducer } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

class ChoosingStyleBookStatusReducerModel {
    id = '';
    @field(String) title: string | null = null;
    @field(String) isbn: string | null = null;
    isBorrowed = false;
    @pii() @field(String) borrowedBy: string | null = null;
}

// Handler methods receive the event, the current state, and EventContext
// as a third argument; the context supplies the event source id.
// The method name must be the exact camelCase of the event's class name -
// Chronicle discovers handlers by name, not by parameter type.
@reducer('', undefined, ChoosingStyleBookStatusReducerModel)
class ChoosingStyleBookStatusReducer {
    choosingStyleBookRegistered(
        event: ChoosingStyleBookRegistered,
        current: ChoosingStyleBookStatusReducerModel | undefined,
        context: EventContext
    ): ChoosingStyleBookStatusReducerModel {
        return {
            id: context.eventSourceId,
            title: event.title,
            isbn: event.isbn,
            isBorrowed: false,
            borrowedBy: null
        };
    }

    choosingStyleBookBorrowed(
        event: ChoosingStyleBookBorrowed,
        current: ChoosingStyleBookStatusReducerModel | undefined,
        context: EventContext
    ): ChoosingStyleBookStatusReducerModel {
        return {
            ...(current ?? new ChoosingStyleBookStatusReducerModel()),
            id: context.eventSourceId,
            isBorrowed: true,
            borrowedBy: event.memberName
        };
    }

    choosingStyleBookReturned(
        event: ChoosingStyleBookReturned,
        current: ChoosingStyleBookStatusReducerModel | undefined,
        context: EventContext
    ): ChoosingStyleBookStatusReducerModel {
        return {
            ...(current ?? new ChoosingStyleBookStatusReducerModel()),
            id: context.eventSourceId,
            isBorrowed: false,
            borrowedBy: null
        };
    }
}
```
