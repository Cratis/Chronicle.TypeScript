```typescript
import { readModel, setFrom, setValue } from '@cratis/chronicle';

@readModel()
class ChoosingStyleBookStatusModelBound {
    id = '';

    @setFrom(ChoosingStyleBookRegistered, 'title')
    title = '';

    @setFrom(ChoosingStyleBookRegistered, 'isbn')
    isbn = '';

    @setValue(ChoosingStyleBookBorrowed, true)
    @setValue(ChoosingStyleBookReturned, false)
    isBorrowed = false;

    @setFrom(ChoosingStyleBookBorrowed, 'memberName')
    @setValue(ChoosingStyleBookReturned, null)
    borrowedBy: string | null = null;
}
```
