```typescript
import { fromEvent, Guid, removedWith, setFrom } from '@cratis/chronicle';

@fromEvent(BookBorrowed)
@removedWith(BookReturned)
export class BorrowedBook {
    id: Guid = Guid.empty;

    @setFrom(BookBorrowed, 'memberName')
    memberName = '';
}
```
