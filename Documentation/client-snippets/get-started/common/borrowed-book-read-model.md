```typescript
import { fromEvent, Guid, removedWith, setFrom } from '@cratis/chronicle';

@fromEvent(GetStartedBookBorrowed)
@removedWith(GetStartedBookReturned)
export class GetStartedBorrowedBook {
    id: Guid = Guid.empty;

    @setFrom(GetStartedBookBorrowed, 'memberName')
    memberName = '';
}
```
