```typescript
import { pii, setFrom, setFromContext, setValue } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

export class ChoosingStyleBookStatusModelBound {
    @setFromContext(ChoosingStyleBookRegistered, 'eventSourceId')
    @setFromContext(ChoosingStyleBookBorrowed, 'eventSourceId')
    @setFromContext(ChoosingStyleBookReturned, 'eventSourceId')
    id = '';

    @setFrom(ChoosingStyleBookRegistered, 'title')
    @field(String) title: string | null = null;

    @setFrom(ChoosingStyleBookRegistered, 'isbn')
    @field(String) isbn: string | null = null;

    @setValue(ChoosingStyleBookRegistered, false)
    @setValue(ChoosingStyleBookBorrowed, true)
    @setValue(ChoosingStyleBookReturned, false)
    isBorrowed = false;

    @pii()
    @setFrom(ChoosingStyleBookBorrowed, 'memberName')
    @setValue(ChoosingStyleBookRegistered, null)
    @setValue(ChoosingStyleBookReturned, null)
    @field(String) borrowedBy: string | null = null;
}
```
