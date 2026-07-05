```typescript
import { reducer } from '@cratis/chronicle';

class ChoosingStyleBookStatusReducerModel {
    title = '';
    isbn = '';
    isBorrowed = false;
    borrowedBy: string | null = null;
}

// Handler methods receive only the event and the current state - there is no
// event-context parameter, unlike the C# reducer's EventContext argument.
// The method name must be the exact camelCase of the event's class name -
// Chronicle discovers handlers by name, not by parameter type.
@reducer('', undefined, ChoosingStyleBookStatusReducerModel)
class ChoosingStyleBookStatusReducer {
    choosingStyleBookRegistered(
        event: ChoosingStyleBookRegistered,
        current: ChoosingStyleBookStatusReducerModel | undefined
    ): ChoosingStyleBookStatusReducerModel {
        return {
            title: event.title,
            isbn: event.isbn,
            isBorrowed: false,
            borrowedBy: null
        };
    }

    choosingStyleBookBorrowed(
        event: ChoosingStyleBookBorrowed,
        current: ChoosingStyleBookStatusReducerModel
    ): ChoosingStyleBookStatusReducerModel {
        return { ...current, isBorrowed: true, borrowedBy: event.memberName };
    }

    choosingStyleBookReturned(
        event: ChoosingStyleBookReturned,
        current: ChoosingStyleBookStatusReducerModel
    ): ChoosingStyleBookStatusReducerModel {
        return { ...current, isBorrowed: false, borrowedBy: null };
    }
}
```
