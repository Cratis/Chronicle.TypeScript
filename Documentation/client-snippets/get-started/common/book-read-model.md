```typescript
import { fromEvent, Guid, setFrom, setValue } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@fromEvent(GetStartedBookAdded)
export class GetStartedBook {
    id: Guid = Guid.empty;

    @setFrom(GetStartedBookAdded, 'title')
    title = '';

    @setFrom(GetStartedBookAdded, 'isbn')
    isbn = '';

    @setValue(GetStartedBookAdded, false)
    @setValue(GetStartedBookBorrowed, true)
    @setValue(GetStartedBookReturned, false)
    onLoan = false;

    @setFrom(GetStartedBookBorrowed, 'memberName')
    @field(String) borrowedBy: string | null = null;
}
```
