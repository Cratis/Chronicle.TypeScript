```typescript
import { fromEvent, Guid, readModel, setFrom, setValue } from '@cratis/chronicle';

@readModel()
@fromEvent(BookAdded)
class Book {
    id: Guid = Guid.empty;

    @setFrom(BookAdded, 'title')
    title = '';

    @setFrom(BookAdded, 'isbn')
    isbn = '';

    @setValue(BookAdded, false)
    @setValue(BookBorrowed, true)
    @setValue(BookReturned, false)
    onLoan = false;

    @setFrom(BookBorrowed, 'memberName')
    borrowedBy: string | null = null;
}
```
