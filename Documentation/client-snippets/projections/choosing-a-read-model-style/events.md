```typescript
import { eventType, pii } from '@cratis/chronicle';

@eventType()
class ChoosingStyleBookRegistered {
    title = '';
    isbn = '';
}

@eventType()
class ChoosingStyleBookBorrowed {
    @pii() memberName = '';
}

@eventType()
class ChoosingStyleBookReturned {
}
```
