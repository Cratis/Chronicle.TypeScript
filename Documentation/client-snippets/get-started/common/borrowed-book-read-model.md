```typescript
import { fromEvent, Guid, readModel, removedWith, setFrom } from '@cratis/chronicle';

@readModel()
@fromEvent(GetStartedBookBorrowed)
@removedWith(GetStartedBookReturned)
class GetStartedBorrowedBook {
    id: Guid = Guid.empty;

    @setFrom(GetStartedBookBorrowed, 'memberName')
    memberName = '';
}
```
