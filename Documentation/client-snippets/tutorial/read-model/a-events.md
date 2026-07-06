```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class BookBorrowed {
    constructor(readonly memberName: string) {}
}

@eventType()
class BookReturned {
}
```
