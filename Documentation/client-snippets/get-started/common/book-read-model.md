```typescript
import { fromEvent, Guid, readModel, setFrom, setValue } from '@cratis/chronicle';

@readModel()
@fromEvent(GetStartedBookAdded)
class GetStartedBook {
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
    borrowedBy: string | null = null;
}
```
