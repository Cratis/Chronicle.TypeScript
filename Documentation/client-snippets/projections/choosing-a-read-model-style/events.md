```typescript
import { eventType } from '@cratis/chronicle';

@eventType()
class ChoosingStyleBookRegistered {
    title = '';
    isbn = '';
}

@eventType()
class ChoosingStyleBookBorrowed {
    memberName = '';
}

@eventType()
class ChoosingStyleBookReturned {
}
```
