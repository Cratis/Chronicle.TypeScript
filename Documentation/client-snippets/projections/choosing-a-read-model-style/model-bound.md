```typescript
import { setFrom, setValue } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

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
    @field(String) borrowedBy: string | null = null;
}
```
