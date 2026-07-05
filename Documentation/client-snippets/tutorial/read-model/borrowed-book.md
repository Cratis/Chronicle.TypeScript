```typescript
import { fromEvent, Guid, readModel, removedWith, setFrom } from '@cratis/chronicle';

@readModel()
@fromEvent(BookBorrowed)
@removedWith(BookReturned)
class BorrowedBook {
    id: Guid = Guid.empty;

    @setFrom(BookBorrowed, 'memberName')
    memberName = '';
}
```
