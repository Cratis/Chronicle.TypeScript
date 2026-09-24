```typescript
import { eventType } from '@cratis/chronicle';
import { field } from '@cratis/fundamentals';

@eventType()
class GetStartedBookAdded {
    @field(String) title: string;
    @field(String) isbn: string;

    constructor(title: string, isbn: string) {
        this.title = title;
        this.isbn = isbn;
    }
}

@eventType()
class GetStartedBookBorrowed {
    @field(String) memberName: string;
    constructor(memberName: string) { this.memberName = memberName; }
}

@eventType()
class GetStartedBookReturned {
}
```
