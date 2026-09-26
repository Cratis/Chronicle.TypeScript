```typescript
import { fromEvent, Guid, setFrom, setValue } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@fromEvent(BookAdded)
export class Book {
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
    @field(String) borrowedBy: string | null = null;
}
```
