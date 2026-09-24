```typescript
import { setFrom, setValue } from '@cratis/chronicle';

export class ChoosingStyleBookStatusModelBound {
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
