```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class BookBorrowed {
    @field(String) memberName: string;
    constructor(memberName: string) { this.memberName = memberName; }
}

@eventType()
class BookReturned {
}
```
